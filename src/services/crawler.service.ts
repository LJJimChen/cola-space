import { Injectable } from '@nestjs/common';
import { chromium } from 'playwright';

@Injectable()
export class CrawlerService {
  private baseUrl = process.env.COFFEE_BASE_URL || 'https://love-coffee.io';
  private loginUrl = `${this.baseUrl}/#/login`;
  // private dashboardUrl = `${this.baseUrl}/#/dashboard`;

  async getSubscriptionUrl(): Promise<string> {
    const headless = process.env.HEADLESS !== 'false';
    const stepDelayMs = process.env.STEP_DELAY_MS
      ? Number(process.env.STEP_DELAY_MS)
      : 300;
    const redirectTimeoutMs = process.env.REDIRECT_TIMEOUT_MS
      ? Number(process.env.REDIRECT_TIMEOUT_MS)
      : 15000;
    const browser = await chromium.launch({ headless, slowMo: stepDelayMs });
    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36',
    });
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], {
      origin: this.baseUrl,
    });
    const page = await context.newPage();
    await page.goto(this.baseUrl, { waitUntil: 'domcontentloaded' });
    try {
      await page.waitForURL((u) => u.toString() !== this.baseUrl, {
        timeout: redirectTimeoutMs,
      });
    } catch (_) {}
    await page.waitForTimeout(10000);
    const current = page.url();
    if (current && /^https?:\/\//.test(current)) {
      const u = new URL(current);
      const newBase = u.origin;
      if (newBase !== this.baseUrl) {
        this.baseUrl = newBase;
        this.loginUrl = `${this.baseUrl}/#/login`;
        await context.grantPermissions(['clipboard-read', 'clipboard-write'], {
          origin: this.baseUrl,
        });
      }
    }
    const username = process.env.COFFEE_USERNAME || '';
    const password = process.env.COFFEE_PASSWORD || '';
    let onDashboard = /#\/dashboard/.test(page.url());
    if (!onDashboard) {
      await page.goto(this.loginUrl, { waitUntil: 'networkidle' });
      onDashboard = /#\/dashboard/.test(page.url());
      if (!onDashboard) {
        let filledUser = false;
        const userLocators = [
          page.getByPlaceholder(/邮箱|email|e-mail/i),
          page.locator('input[placeholder*="邮箱" i]'),
          page.locator('input[type="email"]'),
          page.locator('.block-content input[type="text"]'),
          page.locator('input.form-control-alt[type="text"]'),
          page.locator('input[type="text"]'),
        ];
        for (const l of userLocators) {
          try {
            const c = await l.count();
            if (c > 0) {
              await l.first().fill(username);
              filledUser = true;
              break;
            }
          } catch (_) {}
        }
        let filledPass = false;
        const passLocators = [
          page.getByPlaceholder(/密码|password/i),
          page.locator('input[placeholder*="密码" i]'),
          page.locator('input[type="password"]'),
          page.locator('.block-content input[type="password"]'),
        ];
        for (const l of passLocators) {
          try {
            const c = await l.count();
            if (c > 0) {
              await l.first().fill(password);
              filledPass = true;
              break;
            }
          } catch (_) {}
        }
        const buttonLocators = [
          page.getByRole('button', { name: /登录|登入|sign\s*in|log\s*in/i }),
          page.locator('button[type="submit"]'),
          page.locator('button.btn-primary'),
          page.locator('button:has-text("登入"), button:has-text("登录")'),
        ];
        for (const l of buttonLocators) {
          try {
            const c = await l.count();
            if (c > 0) {
              await l.first().click();
              break;
            }
          } catch (_) {}
        }
        await page.waitForURL((url) => url.toString().includes('#/dashboard'), {
          timeout: 60000,
        });
      }
    }
    await page.waitForLoadState('networkidle');
    await page
      .locator(
        '#main-container > div > div:nth-child(3) > div > div > div.block-content.p-0 > div > div > div:nth-child(2)'
      )
      .click();
    await page.waitForSelector('body div.ant-modal-wrap.ant-modal-centered', {
      timeout: 30000,
    });
    const target = page.locator(
      'body div.ant-modal-wrap.ant-modal-centered div.item___yrtOv.subsrcibe-for-link'
    );
    await target.click();
    await page.waitForTimeout(1000);
    let url = await target.getAttribute('data-clipboard-text');
    if (!url) {
      url = await page.evaluate(() => {
        const el = document.querySelector(
          '[data-clipboard-text]'
        ) as HTMLElement | null;
        return el ? el.getAttribute('data-clipboard-text') : null;
      });
    }
    if (!url) {
      try {
        const clip = await page.evaluate(() => navigator.clipboard.readText());
        if (clip && /^https?:\/\//.test(clip)) url = clip;
      } catch (_) {}
    }
    if (!url) {
      await target.click();
      await page.waitForTimeout(1000);
      url = await target.getAttribute('data-clipboard-text');
    }
    if (!url) {
      const text = await target.innerText();
      const match = text.match(/https?:\/\/[^\s]+/);
      if (match) url = match[0];
    }
    await browser.close();
    if (!url) throw new Error('subscription url not found');
    return url;
  }
}
