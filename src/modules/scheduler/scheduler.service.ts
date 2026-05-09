import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { SubscribeService } from '../subscribe/subscribe.service';

@Injectable()
export class SchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SchedulerService.name);
  private job?: CronJob;
  private weeklyJob?: CronJob;

  constructor(
    private readonly subscribeService: SubscribeService,
    private readonly schedulerRegistry: SchedulerRegistry
  ) {}

  onModuleInit() {
    const expr = process.env.CRON_EXPR || '0 3 * * *';
    const tz = process.env.CRON_TZ || process.env.TZ || 'Asia/Shanghai';
    this.job = new CronJob(expr, async () => {
      if (process.env.CRON_ENABLED === 'false') return;
      try {
        const r = await this.subscribeService.refresh();
        this.logger.log(`refreshed ${JSON.stringify(r)}`);
      } catch (e: any) {
        this.logger.error(`refresh failed ${e?.message || e}`);
      }
    }, undefined, false, tz);
    this.schedulerRegistry.addCronJob('subscribeRefresh', this.job);
    this.job.start();
    this.logger.log(`cron started with expr: ${expr} tz: ${tz}`);
    this.weeklyJob = new CronJob('0 4 * * 0', async () => {
      if (process.env.CRON_ENABLED === 'false') return;
      try {
        const r = await this.subscribeService.refreshForced();
        this.logger.log(`weekly forced refresh ${JSON.stringify(r)}`);
      } catch (e: any) {
        this.logger.error(`weekly forced refresh failed ${e?.message || e}`);
      }
    }, undefined, false, 'Asia/Shanghai');
    this.schedulerRegistry.addCronJob('subscribeWeeklyForcedRefresh', this.weeklyJob);
    this.weeklyJob.start();
    this.logger.log('weekly forced refresh cron started (Sundays at 04:00 Asia/Shanghai)');
  }

  onModuleDestroy() {
    try {
      if (this.job) {
        this.job.stop();
        this.schedulerRegistry.deleteCronJob('subscribeRefresh');
      }
      if (this.weeklyJob) {
        this.weeklyJob.stop();
        this.schedulerRegistry.deleteCronJob('subscribeWeeklyForcedRefresh');
      }
    } catch (_) {}
  }
}
