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

  constructor(
    private readonly subscribeService: SubscribeService,
    private readonly schedulerRegistry: SchedulerRegistry
  ) {}

  onModuleInit() {
    const expr = process.env.CRON_EXPR || '0 3 * * *';
    this.job = new CronJob(expr, async () => {
      if (process.env.CRON_ENABLED === 'false') return;
      try {
        const r = await this.subscribeService.refresh();
        this.logger.log(`refreshed ${JSON.stringify(r)}`);
      } catch (e: any) {
        this.logger.error(`refresh failed ${e?.message || e}`);
      }
    });
    this.schedulerRegistry.addCronJob('subscribeRefresh', this.job);
    this.job.start();
    this.logger.log(`cron started with expr: ${expr}`);
  }

  onModuleDestroy() {
    try {
      if (this.job) {
        this.job.stop();
        this.schedulerRegistry.deleteCronJob('subscribeRefresh');
      }
    } catch (_) {}
  }
}
