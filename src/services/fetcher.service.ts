import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { parse, stringify } from 'yaml';

function padBase64(s: string) {
  const pad = s.length % 4;
  if (pad === 2) return s + '==';
  if (pad === 3) return s + '=';
  if (pad === 1) return s + '===';
  return s;
}

function decodeBase64(s: string) {
  try {
    return Buffer.from(padBase64(s.replace(/\s+/g, '')), 'base64').toString(
      'utf-8'
    );
  } catch (_) {
    return '';
  }
}

function parseSsLink(link: string) {
  const trimmed = link.trim();
  if (!trimmed.startsWith('ss://')) return null;
  const raw = trimmed.slice(5);
  let name = '';
  let params = '';
  let main = raw;
  const hashIdx = raw.indexOf('#');
  if (hashIdx >= 0) {
    name = decodeURIComponent(raw.slice(hashIdx + 1));
    main = raw.slice(0, hashIdx);
  }
  const qIdx = main.indexOf('?');
  if (qIdx >= 0) {
    params = main.slice(qIdx + 1);
    main = main.slice(0, qIdx);
  }
  let decoded = main;
  if (!decoded.includes('@')) {
    const d = decodeBase64(decoded);
    if (d) decoded = d;
  }
  // method:password@host:port
  const atIdx = decoded.indexOf('@');
  if (atIdx < 0) return null;
  const auth = decoded.slice(0, atIdx);
  const hostPort = decoded.slice(atIdx + 1);
  const colonIdx = auth.indexOf(':');
  if (colonIdx < 0) return null;
  const method = auth.slice(0, colonIdx);
  const password = auth.slice(colonIdx + 1);
  const hpColonIdx = hostPort.lastIndexOf(':');
  if (hpColonIdx < 0) return null;
  const host = hostPort.slice(0, hpColonIdx);
  const portStr = hostPort.slice(hpColonIdx + 1);
  const port = Number(portStr);
  const proxy: any = {
    name: name || host,
    type: 'ss',
    server: host,
    port: isFinite(port) ? port : 0,
    cipher: method,
    password,
    udp: true,
  };
  if (params) {
    const m = params.match(/plugin=([^&]+)/i);
    if (m) proxy.plugin = decodeURIComponent(m[1]);
  }
  return proxy;
}

function buildClashYamlFromSs(raw: string) {
  const lines = raw
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter((s) => s);
  const proxies: any[] = [];
  for (const line of lines) {
    const p = parseSsLink(line);
    if (p) proxies.push(p);
  }
  const names = proxies.map((p) => p.name);
  const groups = [
    {
      name: '自动选择',
      type: 'url-test',
      url: 'http://www.gstatic.com/generate_204',
      interval: 300,
      tolerance: 50,
      proxies: names,
    },
    {
      name: '故障转移',
      type: 'fallback',
      url: 'http://www.gstatic.com/generate_204',
      interval: 300,
      proxies: names,
    },
    {
      name: '全部节点',
      type: 'select',
      proxies: ['自动选择', '故障转移', ...names],
    },
  ];
  const rules = ['MATCH,全部节点'];
  const doc: any = { proxies, 'proxy-groups': groups, rules };
  return stringify(doc);
}

function enhanceClashConfig(yamlString: string) {
  let doc: any;
  try {
    doc = parse(yamlString);
  } catch (e) {
    return yamlString;
  }

  if (!doc || !doc.proxies || !Array.isArray(doc.proxies)) {
    return yamlString;
  }

  const proxies = doc.proxies;
  
  // Filter for US proxies (Google/AI requirement)
  const usProxies = proxies
    .filter(
      (p: any) =>
        p.name &&
        (p.name.includes('US') ||
          p.name.includes('🇺🇸') ||
          p.name.includes('United States') ||
          p.name.includes('美国'))
    )
    .map((p: any) => p.name);

  // If US proxies exist, use them for AI-Group, otherwise use all proxies
  const aiProxies = usProxies.length > 0 ? usProxies : proxies.map((p: any) => p.name);

  const aiGroup = {
    name: 'AI-Group',
    type: 'url-test',
    url: 'http://www.gstatic.com/generate_204',
    interval: 300,
    proxies: aiProxies,
  };

  if (!doc['proxy-groups']) {
    doc['proxy-groups'] = [];
  }
  doc['proxy-groups'].unshift(aiGroup);

  const targetGroup = 'AI-Group';

  // Add rules for Google, Gemini, and ChatGPT
  const newRules = [
    // Google
    `DOMAIN-SUFFIX,google.com,${targetGroup}`,
    `DOMAIN-KEYWORD,google,${targetGroup}`,
    `DOMAIN-SUFFIX,youtube.com,${targetGroup}`,
    `DOMAIN-KEYWORD,youtube,${targetGroup}`,
    `DOMAIN-SUFFIX,gstatic.com,${targetGroup}`,
    `DOMAIN-SUFFIX,googleapis.com,${targetGroup}`,
    `DOMAIN-SUFFIX,googleusercontent.com,${targetGroup}`,
    `DOMAIN-SUFFIX,gvt1.com,${targetGroup}`,
    `DOMAIN-SUFFIX,googlevideo.com,${targetGroup}`,
    // Gemini
    `DOMAIN,gemini.google.com,${targetGroup}`,
    `DOMAIN,bard.google.com,${targetGroup}`,
    `DOMAIN,generativelanguage.googleapis.com,${targetGroup}`,
    // ChatGPT
    `DOMAIN-SUFFIX,openai.com,${targetGroup}`,
    `DOMAIN-SUFFIX,chatgpt.com,${targetGroup}`,
    `DOMAIN-SUFFIX,ai.com,${targetGroup}`,
    `DOMAIN-SUFFIX,oaistatic.com,${targetGroup}`,
    `DOMAIN-SUFFIX,oaiusercontent.com,${targetGroup}`,
    `DOMAIN-SUFFIX,auth0.com,${targetGroup}`, // Common for ChatGPT login
    `DOMAIN-SUFFIX,identrust.com,${targetGroup}`,
  ];

  if (!doc.rules) {
    doc.rules = [];
  }
  doc.rules.unshift(...newRules);

  return stringify(doc);
}

@Injectable()
export class FetcherService {
  async fetchYaml(url: string): Promise<{
    data: string;
    headers: Record<string, string>;
    status: number;
    statusText: string;
  }> {
    const r = await axios.get<string>(url, {
      responseType: 'text',
      timeout: 30000,
      headers: {
        'User-Agent': 'Clash',
        Accept: 'text/yaml,text/plain;q=0.9,*/*;q=0.8',
      },
    });
    const headers: Record<string, string> = {};
    Object.keys(r.headers || {}).forEach((k) => {
      const v = (r.headers as any)[k];
      if (typeof v === 'string') headers[k] = v;
    });
    let data = r.data;
    let parsed: any = null;
    try {
      parsed = parse(data);
    } catch (_) {
      parsed = null;
    }
    if (!parsed || (!parsed.proxies && !parsed['proxy-groups'])) {
      data = buildClashYamlFromSs(data);
    }
    data = enhanceClashConfig(data);
    return {
      data,
      headers,
      status: r.status,
      statusText: r.statusText,
    };
  }
}
