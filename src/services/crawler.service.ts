import { Injectable, Logger } from '@nestjs/common';
import { chromium } from 'playwright';

@Injectable()
export class CrawlerService {
  private baseUrl = process.env.COFFEE_BASE_URL || 'https://love-coffee.io';
  private loginUrl = `${this.baseUrl}/#/login`;
  // private dashboardUrl = `${this.baseUrl}/#/dashboard`;
  private readonly logger = new Logger(CrawlerService.name);

  async getSubscriptionInfo(): Promise<{ url: string; usage?: { used: number; total: number } }> {
    const headless = process.env.HEADLESS !== 'false';
    const stepDelayMs = process.env.STEP_DELAY_MS
      ? Number(process.env.STEP_DELAY_MS)
      : 300;
    const redirectTimeoutMs = process.env.REDIRECT_TIMEOUT_MS
      ? Number(process.env.REDIRECT_TIMEOUT_MS)
      : 15000;
    this.logger.log(`start headless=${headless} base=${this.baseUrl}`);
    const browser = await chromium.launch({ headless, slowMo: stepDelayMs });
    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36',
    });
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], {
      origin: this.baseUrl,
    });
    const page = await context.newPage();
    try {
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
        this.logger.log(`redirected base to ${this.baseUrl}`);
      }
    }
    const username = process.env.COFFEE_USERNAME || '';
    const password = process.env.COFFEE_PASSWORD || '';
    let onDashboard = /#\/dashboard/.test(page.url());
    if (!onDashboard) {
      this.logger.log('navigate login');
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
              this.logger.log('filled username');
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
              this.logger.log('filled password');
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
              this.logger.log('clicked login');
              break;
            }
          } catch (_) {}
        }
        await page.waitForURL((url) => url.toString().includes('#/dashboard'), {
          timeout: 60000,
        });
      }
    }
    this.logger.log('dashboard ready');
    await page.waitForLoadState('networkidle');

    // Extract usage info
    let usage: { used: number; total: number } | undefined;
    try {
      const text = await page.innerText('body');
      // Look for patterns like "已用 10.5 GB" "剩余 89.5 GB" "总计 100 GB"
      // or "10.5 GB / 100 GB"
      
      const parseSize = (str: string) => {
        const m = str.match(/([\d.]+)\s*(GB|MB|KB|B)/i);
        if (!m) return 0;
        const val = parseFloat(m[1]);
        const unit = m[2].toUpperCase();
        if (unit === 'GB') return val * 1024 * 1024 * 1024;
        if (unit === 'MB') return val * 1024 * 1024;
        if (unit === 'KB') return val * 1024;
        return val;
      };

      // Try to find "Used" and "Total" numbers
      // Example: "已用: 50GB" "总计: 100GB"
      // Or look for progress bars usually having text inside or nearby
      
      // Strategy: Find all text matching size pattern, and try to deduce context
      // But simpler: look for "已用" (Used) and "总计" (Total) near numbers
      
      const usedMatch = text.match(/(已用|Used)\s*[:：]?\s*([\d.]+\s*[GMK]B)/i);
      const totalMatch = text.match(/(总计|总共|Total)\s*[:：]?\s*([\d.]+\s*[GMK]B)/i);
      
      if (usedMatch && totalMatch) {
        usage = {
          used: parseSize(usedMatch[2]),
          total: parseSize(totalMatch[2]),
        };
      } else {
         // Try finding "X GB / Y GB" pattern
         const slashMatch = text.match(/([\d.]+\s*[GMK]B)\s*\/\s*([\d.]+\s*[GMK]B)/i);
         if (slashMatch) {
             usage = {
                 used: parseSize(slashMatch[1]),
                 total: parseSize(slashMatch[2])
             };
         }
      }
      if (usage) {
        this.logger.log(`Found usage: ${(usage.used / 1024 / 1024 / 1024).toFixed(2)}GB / ${(usage.total / 1024 / 1024 / 1024).toFixed(2)}GB`);
      } else {
        this.logger.warn('Could not extract usage info');
      }
    } catch (e) {
      this.logger.warn(`Failed to extract usage: ${e}`);
    }

    await page
      .locator(
        '#main-container > div > div:nth-child(3) > div > div > div.block-content.p-0 > div > div > div:nth-child(2)'
      )
      .click();
    this.logger.log('open subscription modal');
    await page.waitForSelector('body div.ant-modal-wrap.ant-modal-centered', {
      timeout: 30000,
    });
    const target = page.locator(
      'body div.ant-modal-wrap.ant-modal-centered div.item___yrtOv.subsrcibe-for-link'
    );
    await target.click();
    this.logger.log('click subscription link');
    await page.waitForTimeout(1000);
    let url = await target.getAttribute('data-clipboard-text');
    if (!url) {
      url = await page.evaluate(() => {
        const el = document.querySelector(
          '[data-clipboard-text]'
        ) as HTMLElement | null;
        return el ? el.getAttribute('data-clipboard-text') : null;
      });
      if (url) this.logger.log('got url from attribute');
    }
    if (!url) {
      try {
        const clip = await page.evaluate(() => navigator.clipboard.readText());
        if (clip && /^https?:\/\//.test(clip)) url = clip;
      } catch (_) {}
      if (url) this.logger.log('got url from clipboard');
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
      if (url) this.logger.log('got url from inner text');
    }
    
    if (!url) throw new Error('subscription url not found');
    this.logger.log('subscription url found');
    return { url, usage };
    } finally {
        await browser.close();
    }
  }

  async getSubscriptionUrl(): Promise<string> {
      const info = await this.getSubscriptionInfo();
      return info.url;
  }

}
