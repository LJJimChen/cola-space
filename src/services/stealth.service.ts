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
      await locator.boundingBox().then((b: DOMRect | null) => b ? b.x + b.width / 2 + this.randomInt(-20, 20) : 0),
      await locator.boundingBox().then((b: DOMRect | null) => b ? b.y + b.height / 2 + this.randomInt(-20, 20) : 0),
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
      await page.evaluate((s: number) => window.scrollBy(0, s), step);
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
