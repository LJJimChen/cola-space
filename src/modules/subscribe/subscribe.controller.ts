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
    const { yaml, etag, headers, status } =
      await this.subscribeService.getLatestYaml();
    if (etag && inm && inm === etag) {
      res.status(304);
      res.end();
      return;
    }
    res.setHeader('Content-Type', 'text/yaml; charset=utf-8');
    if (etag) res.setHeader('ETag', etag);
    if (headers) {
      for (const k of Object.keys(headers)) {
        const v = headers[k];
        if (v && !['content-type', 'etag'].includes(k.toLowerCase())) {
          res.setHeader(k, v);
        }
      }
    }
    if (status) res.status(status);
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

  @Get('url')
  async getLatestUrl() {
    return this.subscribeService.getLatestUrl();
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
