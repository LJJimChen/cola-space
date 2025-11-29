import {
  Controller,
  Get,
  Post,
  Query,
  Res,
  Headers,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { SubscribeService } from './subscribe.service';

@Controller('subscribe')
export class SubscribeController {
  constructor(private readonly subscribeService: SubscribeService) {}

  @Get('clash')
  async getClash(@Res() res: any, @Headers('if-none-match') inm?: string) {
    const { yaml, etag } = await this.subscribeService.getLatestYaml();
    if (etag && inm && inm === etag) {
      res.status(304);
      res.end();
      return;
    }
    res.setHeader('Content-Type', 'text/yaml; charset=utf-8');
    if (etag) res.setHeader('ETag', etag);
    res.send(yaml);
  }

  @Get('sample')
  async getClasSample(@Res() res: any) {
    const { yaml, etag } = await this.subscribeService.getSampleYaml();
    res.setHeader('Content-Type', 'text/yaml; charset=utf-8');
    if (etag) res.setHeader('ETag', etag);
    res.send(yaml);
  }

  @Get('nodes')
  async getNodes() {
    const nodes = await this.subscribeService.getLatestNodes();
    return nodes;
  }

  @Get('shadowrocket')
  async getShadowrocket(
    @Res() res: any,
    @Headers('if-none-match') inm?: string,
    @Query('base64') base64?: string
  ) {
    const { text, etag } = await this.subscribeService.getShadowrocket(
      ['1', 'true', 'yes'].includes((base64 || '').toLowerCase())
    );
    if (etag && inm && inm === etag) {
      res.status(304);
      res.end();
      return;
    }
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    if (etag) res.setHeader('ETag', etag);
    res.send(text);
  }

  @Get('status')
  async getLatestUrl(@Res() res: any) {
    const meta: any = await this.subscribeService.getLatestUrl();
    const counts = meta?.counts || { proxies: 0, groups: 0, rules: 0 };
    const total = (counts.proxies || 0) + (counts.groups || 0) + (counts.rules || 0);
    const hasData = total > 0;
    const fetchedAt = meta?.fetchedAt || null;
    const fetchedAtHuman = fetchedAt
      ? new Date(fetchedAt).toLocaleString('zh-CN', { hour12: false })
      : '无';
    const url = meta?.url || '';
    const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>订阅状态</title><style>body{margin:0;padding:24px;background:#f7f7f8;color:#111;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Oxygen,Ubuntu,Cantarell,Helvetica Neue,Arial,sans-serif}main{max-width:720px;margin:0 auto}h1{font-size:20px;margin:0 0 16px}section{background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:16px;margin-bottom:16px;box-shadow:0 1px 2px rgba(0,0,0,0.04)}.row{display:flex;justify-content:space-between;align-items:center;margin:8px 0}.label{color:#666}.value{font-weight:600}.badge{display:inline-block;padding:2px 8px;border-radius:999px;font-size:12px;font-weight:600}.ok{background:#e6ffed;color:#047857;border:1px solid #a7f3d0}.warn{background:#fff7ed;color:#b45309;border:1px solid #fed7aa}.counts{display:flex;gap:12px;margin-top:8px}.count{background:#f3f4f6;border:1px solid #e5e7eb;border-radius:8px;padding:8px 12px}.links a{display:inline-block;margin-right:12px;color:#2563eb;text-decoration:none}.links a:hover{text-decoration:underline}</style></head><body><main><h1>订阅状态</h1><section><div class="row"><div class="label">状态</div><div class="value"><span class="badge ${hasData ? 'ok' : 'warn'}">${hasData ? '已获取数据' : '暂无数据'}</span></div></div><div class="row"><div class="label">最近抓取时间</div><div class="value">${fetchedAtHuman}</div></div><div class="row"><div class="label">订阅地址</div><div class="value">${url ? `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>` : '无'}</div></div><div class="counts"><div class="count">节点 ${counts.proxies || 0}</div><div class="count">分组 ${counts.groups || 0}</div><div class="count">规则 ${counts.rules || 0}</div></div></section><section class="links"><a href="/api/subscribe/clash" target="_blank">查看 Clash YAML</a><a href="/api/subscribe/sample" target="_blank">示例 YAML</a><a href="/api/subscribe/shadowrocket" target="_blank">Shadowrocket 链接</a></section></main></body></html>`;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  }

  @Post('refresh')
  async refresh(@Headers('x-api-key') apiKey?: string) {
    const expected = process.env.API_KEY;
    if (!expected || apiKey !== expected)
      throw new HttpException('unauthorized', HttpStatus.UNAUTHORIZED);
    const r = await this.subscribeService.refresh();
    return r;
  }
}
