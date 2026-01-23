import { Injectable, Logger } from '@nestjs/common';
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

  async refresh() {
    this.logger.log('refresh start');
    
    // Try fetching via meta url first
    const meta = await this.storage.getLatestUrl();
    if (meta && meta.url) {
      try {
        this.logger.log('try fetch via meta url');
        const r = await this.fetcher.fetchYaml(meta.url);
        
        // Try to check traffic from headers
        this.checkTrafficFromHeaders(r.headers);

        await this.storage.saveYaml(meta.url, r.data, r.headers);
        this.logger.log('fetched and saved via meta url');
        return { url: meta.url };
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

        await this.storage.saveYaml(url, r.data, r.headers);
        this.logger.log('fetched and saved via crawler url');
        return { url };
      } catch (e: any) {
        this.logger.warn(`crawler attempt ${attempt} failed: ${e.message}`);
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }
    throw new Error('refresh failed after 5 attempts');
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
