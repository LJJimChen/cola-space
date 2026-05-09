# Playwright 爬虫反侦查设计

## 目标

为 `CrawlerService` 增加反侦查能力，减少被目标网站检测为爬虫的概率。

## 方案

引入 `playwright-extra` + `playwright-extra-plugin-stealth`，自动 patch Playwright 常见被检测特征；再补充行为模拟层（鼠标轨迹/滚动/击键）。

## 架构

```
CrawlerService → StealthService
                ├── createStealthContext()  ← 应用 stealth patch
                ├── humanClick(locator)
                ├── humanScroll(page)
                └── humanType(text, inputEl)

原有流程保持不变，仅替换 context 创建方式
```

## 新增文件

### `src/services/stealth.service.ts`

| 方法 | 作用 |
|------|------|
| `createStealthContext(browser)` | 用 playwright-extra 创建 stealth context，分辨率随机 |
| `humanClick(locator)` | 鼠标移入 + 随机延迟后点击 |
| `humanScroll(page)` | 随机次数（1~3）、随机步长滚动，间隔随机 |
| `humanType(text, inputEl)` | 输入文字时模拟人类击键节律（随机间隔） |

### 环境变量

| 变量 | 默认值 | 作用 |
|------|--------|------|
| `STEALTH_SCROLL_MIN` | `1` | 滚动次数下限 |
| `STEALTH_SCROLL_MAX` | `3` | 滚动次数上限 |
| `STEALTH_CLICK_DELAY_MIN` | `50` | 点击延迟下限 ms |
| `STEALTH_CLICK_DELAY_MAX` | `150` | 点击延迟上限 ms |
| `STEALTH_TYPE_DELAY_MIN` | `30` | 击键间隔下限 ms |
| `STEALTH_TYPE_DELAY_MAX` | `80` | 击键间隔上限 ms |

## 集成方式

1. `getSubscriptionInfo()` 中，用 `stealthService.createStealthContext(browser)` 替代原来的 `browser.newContext()`
2. 填充表单时，用 `stealthService.humanType(username, inputEl)` 替代 `fill`
3. 点击按钮前，用 `stealthService.humanClick(locator)` 替代 `click`
4. 页面加载后，用 `stealthService.humanScroll(page)` 模拟滚动

## stealth patch 覆盖的特征

- `navigator.webdriver` → `false`
- `navigator.plugins` → 填充真实浏览器插件列表
- `webdriver 版本暴露` → 隐藏
- `WebGL 指纹` → 模拟真实显卡信息
- `Canvas 指纹` → 添加噪声
- `Automation 检测` → patch 掉常见检测点

## 测试方式

手动验证：`HEADLESS=false pnpm run start:dev`，观察浏览器行为是否自然。

## 依赖

```bash
pnpm add playwright-extra playwright-extra-plugin-stealth
```

## 实施步骤

1. 安装依赖
2. 创建 `src/services/stealth.service.ts`
3. 在 `CrawlerService` 中注入 `StealthService`，替换 context 创建方式
4. 替换 `fill` → `humanType`，`click` → `humanClick`，添加 `humanScroll`
