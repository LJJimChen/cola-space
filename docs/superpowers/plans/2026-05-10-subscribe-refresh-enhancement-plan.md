# Subscribe Refresh Enhancement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Two enhancements to subscription refresh: (1) treat zero nodes as fetch failure fallback to crawler, (2) add weekly forced-crawler cron on Sundays at 04:00 Asia/Shanghai.

**Architecture:** Change 1 modifies `SubscribeService.refresh()` to check node count after meta URL fetch. Change 2 adds a second CronJob in `SchedulerService` and a new `refreshForced()` method in `SubscribeService`.

**Tech Stack:** NestJS, @nestjs/schedule, cron

---

## File Structure

- Modify: `src/modules/subscribe/subscribe.service.ts` — add node count check, add `refreshForced()` method
- Modify: `src/modules/scheduler/scheduler.service.ts` — add weekly cron job

---

## Task 1: Empty nodes fallback to crawler in `SubscribeService.refresh()`

**Files:**
- Modify: `src/modules/subscribe/subscribe.service.ts:17-65`

- [ ] **Step 1: Add helper to count proxies in YAML**

After the imports (after line 15), add a private helper method to `SubscribeService`:

```typescript
private countProxies(data: string): number {
  try {
    const parsed = (0, import('yaml').parse)(data);
    if (!parsed) return 0;
    if (Array.isArray(parsed?.proxies)) return parsed.proxies.length;
    if (Array.isArray(parsed?.['proxy-groups'])) {
      // Sum all proxies across groups
      return parsed['proxy-groups'].reduce(
        (sum: number, g: any) => sum + (Array.isArray(g?.proxies) ? g.proxies.length : 0),
        0,
      );
    }
    return 0;
  } catch (_) {
    return 0;
  }
}
```

- [ ] **Step 2: Modify the meta URL fetch block to check for zero nodes**

Find the block starting at line 23:
```typescript
const r = await this.fetcher.fetchYaml(meta.url);
```

After this line (before `saveYaml`), add:

```typescript
const nodeCount = this.countProxies(r.data);
if (nodeCount === 0) {
  throw new Error('no nodes in fetched YAML via meta url');
}
```

This will cause the catch at line 33 to trigger and fall back to crawler.

- [ ] **Step 3: Commit**

```bash
git add src/modules/subscribe/subscribe.service.ts
git commit -m "feat(subscribe): fallback to crawler when fetched YAML has zero nodes"
```

---

## Task 2: Add `refreshForced()` method to `SubscribeService`

**Files:**
- Modify: `src/modules/subscribe/subscribe.service.ts`

- [ ] **Step 1: Add `refreshForced()` method**

After the `refresh()` method (after line 65, before `checkTrafficFromHeaders`), add:

```typescript
async refreshForced() {
  this.logger.log('refreshForced start — skipping meta url, using crawler only');

  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const info = await this.crawler.getSubscriptionInfo();
      const url = info.url;
      this.logger.log(`refreshForced crawler obtained url attempt ${attempt}`);

      if (info.usage) {
        await this.checkAndNotifyTraffic(info.usage.used, info.usage.total);
      }

      const r = await this.fetcher.fetchYaml(url);
      await this.storage.saveYaml(url, r.data, r.headers);
      this.logger.log('refreshForced fetched and saved via crawler url');
      return { url };
    } catch (e: any) {
      this.logger.warn(`refreshForced attempt ${attempt} failed: ${e.message}`);
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
  throw new Error('refreshForced failed after 5 attempts');
}
```

- [ ] **Step 2: Commit**

```bash
git add src/modules/subscribe/subscribe.service.ts
git commit -m "feat(subscribe): add refreshForced method for weekly forced crawler refresh"
```

---

## Task 3: Add weekly forced-crawler cron in `SchedulerService`

**Files:**
- Modify: `src/modules/scheduler/scheduler.service.ts`

- [ ] **Step 1: Add weekly cron job declaration**

At line 14, change:
```typescript
private job?: CronJob;
```
to:
```typescript
private job?: CronJob;
private weeklyJob?: CronJob;
```

- [ ] **Step 2: Add weekly cron job in `onModuleInit`**

After the existing job setup block (after line 34), add:

```typescript
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
```

- [ ] **Step 3: Clean up weekly job in `onModuleDestroy`**

In `onModuleDestroy`, add after the existing job cleanup:

```typescript
try {
  if (this.weeklyJob) {
    this.weeklyJob.stop();
    this.schedulerRegistry.deleteCronJob('subscribeWeeklyForcedRefresh');
  }
} catch (_) {}
```

Combine with the existing try/catch that already handles the main job — update the existing `onModuleDestroy` to clean both jobs in a single try/catch block.

- [ ] **Step 4: Commit**

```bash
git add src/modules/scheduler/scheduler.service.ts
git commit -m "feat(scheduler): add weekly forced crawler refresh cron (Sundays 04:00 Asia/Shanghai)"
```