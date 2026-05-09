# Subscribe Refresh Enhancement Design

## Date: 2026-05-09

## Summary

Two changes to the subscription refresh logic:
1. Treat fetch results with zero nodes as failure, fallback to crawler
2. Add a weekly forced-crawler refresh on Sunday at 04:00 Asia/Shanghai

## Change 1: Empty nodes triggers fallback

**Location:** `src/modules/subscribe/subscribe.service.ts` — `refresh()` method

**Current behavior:** After fetching via meta URL (line 20-36), if the fetch succeeds, it saves and returns without checking if the result has any nodes.

**New behavior:** After `this.fetcher.fetchYaml(meta.url)` and before `this.storage.saveYaml`, check if the fetched YAML contains any proxies. If zero proxies found, treat it as a failed fetch and throw an error to trigger the existing crawler fallback loop.

**Implementation:** Parse the result data, count proxies. If count === 0, throw an error with a descriptive message (e.g., "no nodes in fetched YAML").

---

## Change 2: Weekly forced-crawler cron job

**Location:** `src/modules/scheduler/scheduler.service.ts`

**Schedule:** Every Sunday at 04:00 Asia/Shanghai (hardcoded)

**Behavior:** Skips the meta URL step and goes directly to crawler. Respects `CRON_ENABLED=false`.

**Implementation:**

1. Add a second `CronJob` in `onModuleInit()`:
   ```ts
   const weeklyJob = new CronJob('0 4 * * 0', async () => {
     if (process.env.CRON_ENABLED === 'false') return;
     try {
       const r = await this.subscribeService.refreshForced();
       this.logger.log(`weekly forced refresh ${JSON.stringify(r)}`);
     } catch (e: any) {
       this.logger.error(`weekly forced refresh failed ${e?.message || e}`);
     }
   }, undefined, false, 'Asia/Shanghai');
   this.schedulerRegistry.addCronJob('subscribeWeeklyForcedRefresh', weeklyJob);
   weeklyJob.start();
   ```

2. Add new method `refreshForced()` in `SubscribeService`:
   - Copies the crawler loop from `refresh()` (lines 38-63)
   - Skips the meta URL fetch section entirely
   - Returns `{ url }` on success
   - Throws error after 5 failed attempts

3. `onModuleDestroy()`: also stop and remove the `weeklyJob`.