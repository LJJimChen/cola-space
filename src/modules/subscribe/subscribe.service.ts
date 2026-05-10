import { Injectable, Logger } from '@nestjs/common';
import { parse as parseYaml } from 'yaml';
import { CrawlerService } from '../../services/crawler.service';
import { FetcherService } from '../../services/fetcher.service';
import { StorageService } from '../../services/storage.service';
import { MailService } from '../../services/mail.service';

@Injectable()
export class SubscribeService {
  constructor(
    private readonly crawler: CrawlerService,
    private readonly fetcher: FetcherService,
    private readonly storage: StorageService,
    private readonly mail: MailService
  ) {}
  private readonly logger = new Logger(SubscribeService.name);

  private countProxies(data: string): number {
    try {
      const parsed = parseYaml(data);
      if (!parsed) return 0;
      if (Array.isArray(parsed?.proxies)) return parsed.proxies.length;
      if (Array.isArray(parsed?.['proxy-groups'])) {
        return parsed['proxy-groups'].reduce(
          (sum: number, g: any) => sum + (Array.isArray(g?.proxies) ? g.proxies.length : 0),
          0,
        );
      }
      return 0;
    } catch (_) {
      return 0;
    }
  }

  private async validateAndSave(
    url: string,
    data: string,
    headers: Record<string, string>,
    source: 'meta-url' | 'crawler',
    attempt?: number
  ) {
    const nodeCount = this.countProxies(data);

    if (nodeCount === 0) {
      await this.notifyEmptyNodes(source, url, attempt);
      throw new Error(`no nodes fetched from ${source}`);
    }

    // Try to check traffic from headers
    this.checkTrafficFromHeaders(headers);

    await this.storage.saveYaml(url, data, headers);
    this.logger.log(`fetched and saved via ${source}, nodes: ${nodeCount}`);
    return { url };
  }

  async refresh() {
    this.logger.log('refresh start');
    
    // Try fetching via meta url first
    const meta = await this.storage.getLatestUrl();
    if (meta && meta.url) {
      try {
        this.logger.log('try fetch via meta url');
        const r = await this.fetcher.fetchYaml(meta.url);
        return await this.validateAndSave(meta.url, r.data, r.headers, 'meta-url');
      } catch (_) {
        this.logger.warn('fetch via meta url failed');
      }
    }

    this.logger.log('fallback to crawler');
    for (let attempt = 1; attempt <= 5; attempt++) {
      try {
        const info = await this.crawler.getSubscriptionInfo();
        const url = info.url;
        this.logger.log(`crawler obtained url attempt ${attempt}`);
        
        if (info.usage) {
          await this.checkAndNotifyTraffic(info.usage.used, info.usage.total);
        }

        const r = await this.fetcher.fetchYaml(url);
        
        // If crawler didn't provide usage, try headers
        if (!info.usage) {
          this.checkTrafficFromHeaders(r.headers);
        }

        return await this.validateAndSave(url, r.data, r.headers, 'crawler', attempt);
      } catch (e: any) {
        this.logger.warn(`crawler attempt ${attempt} failed: ${e.message}`);
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }
    throw new Error('refresh failed after 5 attempts');
  }

  async refreshForced() {
    this.logger.log('refreshForced start — skipping meta url, using crawler only');

    for (let attempt = 1; attempt <= 5; attempt++) {
      try {
        const info = await this.crawler.getSubscriptionInfo();
        const url = info.url;
        this.logger.log(`refreshForced crawler obtained url attempt ${attempt}`);

        if (info.usage) {
          await this.checkAndNotifyTraffic(info.usage.used, info.usage.total);
        }

        const r = await this.fetcher.fetchYaml(url);
        await this.storage.saveYaml(url, r.data, r.headers);
        this.logger.log('refreshForced fetched and saved via crawler url');
        return { url };
      } catch (e: any) {
        this.logger.warn(`refreshForced attempt ${attempt} failed: ${e.message}`);
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }
    throw new Error('refreshForced failed after 5 attempts');
  }

  private checkTrafficFromHeaders(headers: Record<string, string>) {
    if (!process.env.MAIL_TO) return;

    // Header key is usually 'subscription-userinfo'
    const key = Object.keys(headers).find(k => k.toLowerCase() === 'subscription-userinfo');
    if (!key) return;

    const val = headers[key];
    if (!val) return;

    // Format: upload=123; download=456; total=789; expire=123
    const parts = val.split(';').map(p => p.trim());
    let upload = 0;
    let download = 0;
    let total = 0;

    for (const part of parts) {
      if (part.startsWith('upload=')) upload = Number(part.split('=')[1]) || 0;
      if (part.startsWith('download=')) download = Number(part.split('=')[1]) || 0;
      if (part.startsWith('total=')) total = Number(part.split('=')[1]) || 0;
    }

    if (total > 0) {
      this.checkAndNotifyTraffic(upload + download, total);
    }
  }

  private async checkAndNotifyTraffic(used: number, total: number) {
    if (!process.env.MAIL_TO) return;

    const threshold = Number(process.env.TRAFFIC_THRESHOLD) || 0.5;
    const ratio = total > 0 ? used / total : 0;

    this.logger.log(`Traffic usage: ${(used / 1e9).toFixed(2)}GB / ${(total / 1e9).toFixed(2)}GB (${(ratio * 100).toFixed(1)}%)`);

    if (ratio > threshold) {
      const subject = `[Cola-Space] Traffic Alert: ${(ratio * 100).toFixed(1)}% Used`;
      const text = `Traffic usage has exceeded ${(threshold * 100).toFixed(0)}%.\n\nUsed: ${(used / 1e9).toFixed(2)} GB\nTotal: ${(total / 1e9).toFixed(2)} GB\nRatio: ${(ratio * 100).toFixed(1)}%`;
      await this.mail.sendMail(subject, text);
    }
  }

  private async notifyEmptyNodes(source: string, url: string, attempt?: number) {
    if (!process.env.MAIL_TO) return;

    const subject = `[Cola-Space] Critical: No nodes fetched`;
    const attemptText = attempt ? `Attempt ${attempt} / 5` : 'Single attempt';
    const text = `Failed to fetch valid subscription data. No proxy nodes found.

${attemptText}
Source: ${source}
URL: ${url}

Old data has been preserved. The system will retry automatically.`;

    await this.mail.sendMail(subject, text);
    this.logger.log(`Empty nodes notification sent for ${source} attempt ${attempt || 1}`);
  }

  async getLatestYaml() {
    const yaml = await this.storage.getLatestYaml();
    const etag = this.storage.computeEtag(yaml);
    const meta = await this.storage.getLatestUrl();
    return {
      yaml,
      etag,
      headers: (meta as any).headers || {},
    };
  }

  async getLatestUrl() {
    return this.storage.getLatestUrl();
  }

  async getLatestNodes() {
    return this.storage.getLatestNodes();
  }

  async getShadowrocket(base64All?: boolean) {
    let nodes = await this.storage.getLatestNodes();
    if (!nodes || nodes.length === 0) {
      const yaml = await this.storage.getLatestYaml();
      try {
        const obj: any = (await import('yaml')).parse(yaml);
        nodes = Array.isArray(obj?.proxies) ? obj.proxies : [];
      } catch (_) {
        nodes = [];
      }
    }
    const lines: string[] = [];
    for (const n of nodes as any[]) {
      if (!n || n.type !== 'ss') continue;
      const cipher = n.cipher || n.method || '';
      const password = n.password || '';
      const server = n.server || '';
      const port = Number(n.port || 0);
      if (!cipher || !password || !server || !port) continue;
      const auth = Buffer.from(
        `${cipher}:${password}@${server}:${port}`,
        'utf-8'
      ).toString('base64');
      let url = `ss://${auth}`;
      if (n.plugin) {
        const plugin = encodeURIComponent(n.plugin);
        url += `?plugin=${plugin}`;
      }
      const name = encodeURIComponent(n.name || server);
      url += `#${name}`;
      lines.push(url);
    }
    let text = lines.join('\n');
    if (base64All) {
      text = Buffer.from(text, 'utf-8').toString('base64');
    }
    const etag = this.storage.computeEtag(text);
    return { text, etag };
  }

  async getSampleYaml() {
    const yaml = await this.storage.readSampleYaml();
    const etag = this.storage.computeEtag(yaml);
    return { yaml, etag };
  }
}
