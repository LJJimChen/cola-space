import { Injectable } from '@nestjs/common';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { parse } from 'yaml';

type Meta = {
  url: string;
  fetchedAt: string;
  counts: { proxies: number; groups: number; rules: number };
  headers?: Record<string, string>;
  status?: number;
  statusText?: string;
};

@Injectable()
export class StorageService {
  private dataDir = (() => {
    const raw = (process.env.DATA_DIR || '').trim();
    if (raw) {
      return path.isAbsolute(raw) ? raw : path.join(process.cwd(), raw);
    }
    return path.join(process.cwd(), '.data');
  })();
  private yamlPath = path.join(this.dataDir, 'latest.yml');
  private metaPath = path.join(this.dataDir, 'meta.json');
  private nodesPath = path.join(this.dataDir, 'nodes.json');

  async ensureDir() {
    await fs.mkdir(this.dataDir, { recursive: true });
  }

  computeEtag(content: string) {
    return crypto.createHash('md5').update(content).digest('hex');
  }

  async saveYaml(
    url: string,
    yaml: string,
    headers?: Record<string, string>,
    status?: number,
    statusText?: string
  ) {
    await this.ensureDir();
    let proxiesCount = 0;
    let groupsCount = 0;
    let rulesCount = 0;
    try {
      const obj: any = parse(yaml);
      const proxies: any[] = Array.isArray(obj?.proxies) ? obj.proxies : [];
      const groups: any[] = Array.isArray(obj?.['proxy-groups'])
        ? obj['proxy-groups']
        : [];
      const rules: any[] = Array.isArray(obj?.rules) ? obj.rules : [];
      proxiesCount = proxies.length;
      groupsCount = groups.length;
      rulesCount = rules.length;
      await fs.writeFile(this.nodesPath, JSON.stringify(proxies), 'utf-8');
    } catch (_) {}
    const meta: Meta = {
      url,
      fetchedAt: new Date().toISOString(),
      counts: { proxies: proxiesCount, groups: groupsCount, rules: rulesCount },
      headers,
      status,
      statusText,
    };
    await fs.writeFile(this.yamlPath, yaml, 'utf-8');
    await fs.writeFile(this.metaPath, JSON.stringify(meta), 'utf-8');
  }

  async getLatestYaml() {
    try {
      const txt = await fs.readFile(this.yamlPath, 'utf-8');
      return txt;
    } catch (_) {
      const fallback = await this.readSampleYaml();
      return fallback;
    }
  }

  async getLatestUrl() {
    try {
      const m = JSON.parse(await fs.readFile(this.metaPath, 'utf-8')) as Meta;
      return m;
    } catch (_) {
      return {
        url: null,
        fetchedAt: null,
        counts: { proxies: 0, groups: 0, rules: 0 },
      };
    }
  }

  async getLatestNodes() {
    try {
      const txt = await fs.readFile(this.nodesPath, 'utf-8');
      return JSON.parse(txt);
    } catch (_) {
      return [];
    }
  }

  async readSampleYaml() {
    const p = path.join(process.cwd(), 'sample.yml');
    const txt = await fs.readFile(p, 'utf-8');
    return txt;
  }
}
