# Playwright 爬虫反侦查实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 CrawlerService 增加反侦查能力，通过 playwright-extra stealth plugin + 行为模拟（鼠标/滚动/击键）减少被目标网站检测为爬虫的概率。

**Architecture:** 新增 StealthService 封装 playwright-extra stealth context 创建和行为模拟方法，CrawlerService 注入并使用它替换原来的 context 创建 + 直接的 fill/click 调用。

**Tech Stack:** playwright-extra, playwright-extra-plugin-stealth, playwright

---

## File Map

| 文件 | 作用 |
|------|------|
| `src/services/stealth.service.ts` | 新增：stealth context 创建 + 行为模拟 |
| `src/services/crawler.service.ts` | 修改：注入 StealthService，替换 context/fill/click |
| `package.json` | 修改：添加依赖 |
| `.env` | 修改：添加 stealth 相关环境变量（可选，有默认值）|

---

## Task 1: 安装依赖

**Files:**
- Modify: `package.json`

- [ ] **Step 1: 安装 playwright-extra 及 stealth 插件**

```bash
pnpm add playwright-extra playwright-extra-plugin-stealth
```

- [ ] **Step 2: 验证安装**

```bash
ls node_modules/playwright-extra
ls node_modules/playwright-extra-plugin-stealth
```

---

## Task 2: 创建 StealthService

**Files:**
- Create: `src/services/stealth.service.ts`

- [ ] **Step 1: 编写 StealthService**

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { chromium } from 'playwright-extra';
import stealth from 'playwright-extra-plugin-stealth';

@Injectable()
export class StealthService {
  private readonly logger = new Logger(StealthService.name);

  private randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  private randomUA(): string {
    const uas = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    ];
    return uas[Math.floor(Math.random() * uas.length)];
  }

  private randomViewport() {
    const widths = [1280, 1440, 1600, 1920];
    const height = 720 + Math.floor(Math.random() * 400);
    const width = widths[Math.floor(Math.random() * widths.length)];
    return { width, height };
  }

  async createStealthContext() {
    chromium.use(stealth());

    const headless = process.env.HEADLESS !== 'false';
    const viewport = this.randomViewport();
    const userAgent = this.randomUA();

    const context = await chromium.launch({ headless }).then(b => b.newContext({
      userAgent,
      viewport,
    }));

    this.logger.log(`stealth context created: ${viewport.width}x${viewport.height}, UA: ${userAgent.slice(0, 50)}...`);
    return context;
  }

  async humanClick(page: any, locator: any) {
    await locator.waitFor({ state: 'visible' });
    await page.mouse.move(
      await locator.boundingBox().then(b => b ? b.x + b.width / 2 + this.randomInt(-20, 20) : 0),
      await locator.boundingBox().then(b => b ? b.y + b.height / 2 + this.randomInt(-20, 20) : 0),
    );
    const delay = this.randomInt(
      Number(process.env.STEALTH_CLICK_DELAY_MIN || 50),
      Number(process.env.STEALTH_CLICK_DELAY_MAX || 150),
    );
    await page.waitForTimeout(delay);
    await locator.click();
    this.logger.debug(`human click with ${delay}ms delay`);
  }

  async humanScroll(page: any) {
    const min = Number(process.env.STEALTH_SCROLL_MIN || 1);
    const max = Number(process.env.STEALTH_SCROLL_MAX || 3);
    const times = this.randomInt(min, max);

    for (let i = 0; i < times; i++) {
      const step = this.randomInt(300, 800);
      const interval = this.randomInt(300, 800);
      await page.evaluate((s) => window.scrollBy(0, s), step);
      await page.waitForTimeout(interval);
    }
    this.logger.debug(`human scroll ${times} times`);
  }

  async humanType(page: any, text: string, locator: any) {
    await locator.waitFor({ state: 'visible' });
    await locator.click();
    await locator.fill('');

    const min = Number(process.env.STEALTH_TYPE_DELAY_MIN || 30);
    const max = Number(process.env.STEALTH_TYPE_DELAY_MAX || 80);

    for (const char of text) {
      await page.keyboard.type(char, { delay: this.randomInt(min, max) });
    }
    this.logger.debug(`human typed ${text.length} characters`);
  }
}
```

- [ ] **Step 2: 验证文件语法**

```bash
npx tsc --noEmit src/services/stealth.service.ts
```

---

## Task 3: 修改 CrawlerService 集成 StealthService

**Files:**
- Modify: `src/services/crawler.service.ts`

- [ ] **Step 1: 注入 StealthService，替换 newContext**

在 `crawler.service.ts` 中：
1. 顶部 import 加上 `StealthService`
2. constructor 注入 `StealthService`
3. `getSubscriptionInfo()` 中，把 `const context = await browser.newContext(contextOptions)` 替换为 `const context = await this.stealthService.createStealthContext()`
4. 把所有 `await l.first().fill(xxx)` 替换为 `await this.stealthService.humanType(page, xxx, l.first())`
5. 把所有 `await l.first().click()` 替换为 `await this.stealthService.humanClick(page, l.first())`
6. 在 `page.waitForLoadState('networkidle')` 之后加一行 `await this.stealthService.humanScroll(page)`

具体改动位置（关键段落）：

```typescript
// 原有 import 改为：
import { Injectable, Logger } from '@nestjs/common';
import { existsSync, mkdirSync } from 'fs';
import path from 'path';
import { chromium } from 'playwright-extra';
import { StealthService } from './stealth.service';

// constructor 改为：
constructor(private readonly stealthService: StealthService) {}

// getSubscriptionInfo() 中的 context 创建替换为：
const context = await this.stealthService.createStealthContext();

// fill 调用替换为 humanType，例如原来：
await l.first().fill(username);
// 改为：
await this.stealthService.humanType(page, username, l.first());

// click 调用替换为 humanClick，例如原来：
await l.first().click();
// 改为：
await this.stealthService.humanClick(page, l.first());

// networkidle 之后加滚动：
await page.waitForLoadState('networkidle');
await this.stealthService.humanScroll(page);
```

- [ ] **Step 2: 验证 TypeScript 编译**

```bash
npx tsc --noEmit
```

预期：无编译错误。

---

## Task 4: 添加 .env 示例环境变量（可选）

**Files:**
- Modify: `.env`

- [ ] **Step 1: 添加 stealth 相关环境变量到 .env 注释**

在 `.env` 文件末尾追加（不影响任何默认值，只是文档）：

```
# Stealth 反侦查参数（可选，有默认值）
# STEALTH_SCROLL_MIN=1
# STEALTH_SCROLL_MAX=3
# STEALTH_CLICK_DELAY_MIN=50
# STEALTH_CLICK_DELAY_MAX=150
# STEALTH_TYPE_DELAY_MIN=30
# STEALTH_TYPE_DELAY_MAX=80
```

---

## Task 5: 手动验证

- [ ] **Step 1: 启动服务观察行为**

```bash
HEADLESS=false pnpm run start:dev
```

观察点：
- 浏览器窗口是否显示正常分辨率（非典型 headless 尺寸）
- 滚动是否有人类特征（不是一次滚完）
- 击键是否有间隔（不是瞬间填完）
- 点击是否有延迟

---

## Self-Review Checklist

1. **Spec coverage**: stealth patch ✓，humanClick ✓，humanScroll ✓，humanType ✓，环境变量 ✓
2. **Placeholder scan**: 无 TBD/TODO
3. **Type consistency**: `stealthService.humanClick(page, locator)` — locator 传的是 Playwright locator 对象，与原 `fill`/`click` 接口一致 ✓
