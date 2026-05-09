# Cola-Space

一个用于“自动获取机场订阅 → 统一生成 Clash YAML → 对外提供订阅接口”的 NestJS 服务。支持定时刷新、手动刷新、订阅内容落盘、本地状态查看，以及（可选）流量阈值邮件告警。

## 技术栈

- Node.js + TypeScript（CommonJS）
- NestJS（HTTP API + DI）
- @nestjs/schedule + cron（定时刷新）
- Playwright（必要时登录网页获取最新订阅 URL）
- axios + yaml（订阅拉取与解析/生成）
- 本地文件存储（默认 `./.data`）
- nodemailer（邮件告警）

## 入口与模块

- 入口：`src/main.ts`
  - 加载 `.env` 与 `.env.local`（`.env.local` 覆盖）
  - 全局路由前缀 `/api`
  - 可配置启动时立即刷新（`INIT_REFRESH=true`）
- 根模块：`src/modules/app.module.ts`
  - 导入 `SubscribeModule` 与 `SchedulerModule`

## 运行流程（一次 refresh 会发生什么）

核心逻辑在 `src/modules/subscribe/subscribe.service.ts` 的 `refresh()`：

1. 优先读取本地 `.data/meta.json` 中记录的订阅 URL（上次成功抓取时保存）
2. 若存在 URL，则直接拉取订阅并加工为 Clash YAML；失败则进入第 3 步
3. 使用 Playwright 登录订阅站点页面，爬取最新订阅 URL（最多重试 5 次）
4. 拉取订阅内容并加工
5. 将结果落盘到 `.data`：
   - `latest.yml`：最新 Clash YAML
   - `nodes.json`：节点列表（从 YAML `proxies` 导出）
   - `meta.json`：订阅 URL、抓取时间、响应头、计数等
6. 若配置了邮件告警（`MAIL_TO`）：
   - 优先从订阅响应头 `subscription-userinfo` 解析用量
   - 或从爬虫页面解析到的用量信息判断是否超过阈值并发送告警

## 目录结构

```
src/
  main.ts
  modules/
    app.module.ts
    subscribe/
      subscribe.controller.ts
      subscribe.module.ts
      subscribe.service.ts
    scheduler/
      scheduler.module.ts
      scheduler.service.ts
  services/
    crawler.service.ts
    fetcher.service.ts
    storage.service.ts
    mail.service.ts
data-sample/
  sample.yml
.data/                 # 运行后生成（默认）
  latest.yml
  meta.json
  nodes.json
```

## API（全局前缀 `/api`）

控制器：`src/modules/subscribe/subscribe.controller.ts`

- `GET /api/subscribe/clash`
  - 返回 `text/yaml`
  - 支持 `If-None-Match` / `ETag`（命中返回 304）
  - 会透传部分订阅响应头（如 `subscription-userinfo`）
- `GET /api/subscribe/sample`
  - 返回 `data-sample/sample.yml`
- `GET /api/subscribe/nodes`
  - 返回 `.data/nodes.json`
- `GET /api/subscribe/shadowrocket?base64=1`
  - 从节点中筛选 `ss` 类型并生成 `ss://` 列表
  - `base64=1` 时整体 base64 编码输出
- `GET /api/subscribe/status`
  - 返回 HTML 状态页：最近抓取时间、订阅地址、节点/分组/规则计数、订阅头解析等
- `POST /api/subscribe/refresh`
  - 需要请求头 `x-api-key` 等于环境变量 `API_KEY`

## 配置（环境变量）

示例见 `.env`，实际部署建议用 `.env.local` 覆盖。

基础：

- `PORT`：监听端口
- `API_KEY`：手动刷新接口鉴权（务必改掉默认值）
- `INIT_REFRESH`：启动时是否自动刷新（`true/false`）
- `DATA_DIR`：数据目录（默认 `./.data`）

定时：

- `CRON_ENABLED`：是否启用 cron（设置为 `false` 可禁用）
- `CRON_EXPR`：cron 表达式（默认 `0 3 * * *`）
- `CRON_TZ` / `TZ`：时区（默认 `Asia/Shanghai`）

爬虫（按订阅站点实际情况配置）：

- `COFFEE_BASE_URL`
- `COFFEE_USERNAME`
- `COFFEE_PASSWORD`
- `HEADLESS`：Playwright 是否无头
- `STEP_DELAY_MS`：页面操作延迟（降低被风控概率）

HTTPS（可选）：

- `ENABLE_HTTPS`
- `HTTPS_KEY_PATH`
- `HTTPS_CERT_PATH`

邮件告警（可选）：

- `MAIL_HOST` / `MAIL_PORT`
- `MAIL_USER` / `MAIL_PASS`
- `MAIL_TO`
- `TRAFFIC_THRESHOLD`：阈值（默认 0.5）

## 本地开发

```bash
pnpm install
pnpm run start:dev
```

构建与运行：

```bash
pnpm run build
pnpm run start
```

## 部署（GitHub Actions + PM2）

- CI：`.github/workflows/deploy.yml`
- 部署脚本：`deploy/deploy.js`
- 服务器端 `.env.local` 生成：`deploy/generateEnv.js`
- 新增环境变量的流程说明：`deploy/ENV_README.md`

## 注意事项

- 请务必修改 `API_KEY` 的默认值，避免公开接口被滥用
- 首次运行时如果需要爬虫登录，请确保 `COFFEE_*` 配置完整

