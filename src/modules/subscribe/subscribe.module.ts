import { Module } from '@nestjs/common';
import { SubscribeController } from './subscribe.controller';
import { SubscribeService } from './subscribe.service';
import { CrawlerService } from '../../services/crawler.service';
import { FetcherService } from '../../services/fetcher.service';
import { StorageService } from '../../services/storage.service';
import { MailService } from '../../services/mail.service';

@Module({
  controllers: [SubscribeController],
  providers: [SubscribeService, CrawlerService, FetcherService, StorageService, MailService],
  exports: [SubscribeService],
})
export class SubscribeModule {}
