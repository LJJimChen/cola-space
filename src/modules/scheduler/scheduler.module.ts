import { Module } from '@nestjs/common';
import { SchedulerService } from './scheduler.service';
import { SubscribeModule } from '../subscribe/subscribe.module';

@Module({
  imports: [SubscribeModule],
  providers: [SchedulerService],
})
export class SchedulerModule {}
