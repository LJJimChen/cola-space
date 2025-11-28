import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { SubscribeModule } from './subscribe/subscribe.module';
import { SchedulerModule } from './scheduler/scheduler.module';

@Module({
  imports: [ScheduleModule.forRoot(), SubscribeModule, SchedulerModule],
})
export class AppModule {}
