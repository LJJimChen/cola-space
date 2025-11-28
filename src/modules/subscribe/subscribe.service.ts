import { Injectable } from '@nestjs/common';
import { CrawlerService } from '../../services/crawler.service';
import { FetcherService } from '../../services/fetcher.service';
import { StorageService } from '../../services/storage.service';

@Injectable()
export class SubscribeService {
  constructor(
    private readonly crawler: CrawlerService,
    private readonly fetcher: FetcherService,
    private readonly storage: StorageService
  ) {}

  async refresh() {
    const url = await this.crawler.getSubscriptionUrl();
    const r = await this.fetcher.fetchYaml(url);
    await this.storage.saveYaml(url, r.data, r.headers, r.status, r.statusText);
    return { url };
  }

  async getLatestYaml() {
    const yaml = await this.storage.getLatestYaml();
    const etag = this.storage.computeEtag(yaml);
    const meta = await this.storage.getLatestUrl();
    return {
      yaml,
      etag,
      headers: (meta as any).headers || {},
      status: (meta as any).status || 200,
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
