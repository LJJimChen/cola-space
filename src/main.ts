import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './modules/app.module';
import { readFileSync } from 'fs';
import { SubscribeService } from './modules/subscribe/subscribe.service';
import dotenv from 'dotenv';

dotenv.config({ override: true });
dotenv.config({ path: '.env.local', override: true });

async function bootstrap() {
  const httpsEnabled = ['1', 'true', 'yes'].includes(
    (process.env.ENABLE_HTTPS || '').toLowerCase()
  );
  let app: any;
  if (httpsEnabled) {
    try {
      const keyPath = process.env.HTTPS_KEY_PATH || '';
      const certPath = process.env.HTTPS_CERT_PATH || '';
      const key = readFileSync(keyPath);
      const cert = readFileSync(certPath);
      app = await NestFactory.create(AppModule, {
        httpsOptions: { key, cert },
      });
    } catch (_) {
      app = await NestFactory.create(AppModule);
    }
  } else {
    app = await NestFactory.create(AppModule);
  }
  app.enableShutdownHooks();
  app.setGlobalPrefix('api');
  const initFlag = (process.env.INIT_REFRESH || '').toLowerCase();
  if (['1', 'true', 'yes'].includes(initFlag)) {
    try {
      const svc = app.get(SubscribeService);
      await svc.refresh();
    } catch (_) {}
  }
  await app.listen(process.env.PORT ? Number(process.env.PORT) : 3000);
}

bootstrap();
