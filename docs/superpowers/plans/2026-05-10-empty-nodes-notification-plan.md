# Empty Nodes Notification Implementation Plan

&gt; **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent empty node lists from overwriting valid data, and send email alerts when subscription fetch returns zero nodes

**Architecture:** Add validation helper in SubscribeService that checks node count before calling storage.saveYaml(). All three code paths (meta URL, crawler, refreshForced) use the same validation logic.

**Tech Stack:** NestJS, TypeScript, nodemailer

---

### Task 1: Add notifyEmptyNodes helper method

**Files:**
- Modify: `src/modules/subscribe/subscribe.service.ts:142-155`

- [ ] **Step 1: Add notifyEmptyNodes method after checkAndNotifyTraffic**

Add this new private method right after `checkAndNotifyTraffic()` (around line 155):

```typescript
  private async notifyEmptyNodes(source: string, url: string, attempt?: number) {
    if (!process.env.MAIL_TO) return;

    const subject = `[Cola-Space] Critical: No nodes fetched`;
    const attemptText = attempt ? `Attempt ${attempt} / 5` : 'Single attempt';
    const text = `Failed to fetch valid subscription data. No proxy nodes found.

${attemptText}
Source: ${source}
URL: ${url}

Old data has been preserved. The system will retry automatically.`;

    await this.mail.sendMail(subject, text);
    this.logger.log(`Empty nodes notification sent for ${source} attempt ${attempt || 1}`);
  }
```

- [ ] **Step 2: Verify syntax and build**

Run: `pnpm run build`
Expected: Build completes successfully with no errors

- [ ] **Step 3: Commit**

```bash
git add src/modules/subscribe/subscribe.service.ts
git commit -m "feat: add notifyEmptyNodes helper method"
```

---

### Task 2: Add validateAndSave wrapper method

**Files:**
- Modify: `src/modules/subscribe/subscribe.service.ts:18-33` (after countProxies)

- [ ] **Step 1: Add validateAndSave method after countProxies**

Add this new private method right after `countProxies()` (around line 34):

```typescript
  private async validateAndSave(
    url: string,
    data: string,
    headers: Record<string, string>,
    source: 'meta-url' | 'crawler',
    attempt?: number
  ) {
    const nodeCount = this.countProxies(data);

    if (nodeCount === 0) {
      await this.notifyEmptyNodes(source, url, attempt);
      throw new Error(`no nodes fetched from ${source}`);
    }

    // Try to check traffic from headers
    this.checkTrafficFromHeaders(headers);

    await this.storage.saveYaml(url, data, headers);
    this.logger.log(`fetched and saved via ${source}, nodes: ${nodeCount}`);
    return { url };
  }
```

- [ ] **Step 2: Verify syntax and build**

Run: `pnpm run build`
Expected: Build completes successfully

- [ ] **Step 3: Commit**

```bash
git add src/modules/subscribe/subscribe.service.ts
git commit -m "feat: add validateAndSave wrapper with node count check"
```

---

### Task 3: Update meta URL branch to use validateAndSave

**Files:**
- Modify: `src/modules/subscribe/subscribe.service.ts:35-59` (refresh method meta URL branch)

- [ ] **Step 1: Replace the meta URL branch logic**

Current lines 35-59:

```typescript
  async refresh() {
    this.logger.log('refresh start');
    
    // Try fetching via meta url first
    const meta = await this.storage.getLatestUrl();
    if (meta && meta.url) {
      try {
        this.logger.log('try fetch via meta url');
        const r = await this.fetcher.fetchYaml(meta.url);

        const nodeCount = this.countProxies(r.data);
        if (nodeCount === 0) {
          throw new Error('no nodes in fetched YAML via meta url');
        }

        // Try to check traffic from headers
        this.checkTrafficFromHeaders(r.headers);

        await this.storage.saveYaml(meta.url, r.data, r.headers);
        this.logger.log('fetched and saved via meta url');
        return { url: meta.url };
      } catch (_) {
        this.logger.warn('fetch via meta url failed');
      }
    }
```

Replace with:

```typescript
  async refresh() {
    this.logger.log('refresh start');
    
    // Try fetching via meta url first
    const meta = await this.storage.getLatestUrl();
    if (meta && meta.url) {
      try {
        this.logger.log('try fetch via meta url');
        const r = await this.fetcher.fetchYaml(meta.url);
        return await this.validateAndSave(meta.url, r.data, r.headers, 'meta-url');
      } catch (_) {
        this.logger.warn('fetch via meta url failed');
      }
    }
```

- [ ] **Step 2: Verify syntax and build**

Run: `pnpm run build`
Expected: Build completes successfully

- [ ] **Step 3: Commit**

```bash
git add src/modules/subscribe/subscribe.service.ts
git commit -m "refactor: meta URL branch uses validateAndSave"
```

---

### Task 4: Update crawler branch to use validateAndSave

**Files:**
- Modify: `src/modules/subscribe/subscribe.service.ts:61-88` (refresh method crawler branch)

- [ ] **Step 1: Replace the crawler branch logic**

Current lines 61-88:

```typescript
    this.logger.log('fallback to crawler');
    for (let attempt = 1; attempt <= 5; attempt++) {
      try {
        const info = await this.crawler.getSubscriptionInfo();
        const url = info.url;
        this.logger.log(`crawler obtained url attempt ${attempt}`);
        
        if (info.usage) {
          await this.checkAndNotifyTraffic(info.usage.used, info.usage.total);
        }

        const r = await this.fetcher.fetchYaml(url);
        
        // If crawler didn't provide usage, try headers
        if (!info.usage) {
          this.checkTrafficFromHeaders(r.headers);
        }

        await this.storage.saveYaml(url, r.data, r.headers);
        this.logger.log('fetched and saved via crawler url');
        return { url };
      } catch (e: any) {
        this.logger.warn(`crawler attempt ${attempt} failed: ${e.message}`);
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }
    throw new Error('refresh failed after 5 attempts');
  }
```

Replace with:

```typescript
    this.logger.log('fallback to crawler');
    for (let attempt = 1; attempt <= 5; attempt++) {
      try {
        const info = await this.crawler.getSubscriptionInfo();
        const url = info.url;
        this.logger.log(`crawler obtained url attempt ${attempt}`);
        
        if (info.usage) {
          await this.checkAndNotifyTraffic(info.usage.used, info.usage.total);
        }

        const r = await this.fetcher.fetchYaml(url);
        
        // If crawler didn't provide usage, try headers (not done by validateAndSave)
        if (!info.usage) {
          this.checkTrafficFromHeaders(r.headers);
        }

        return await this.validateAndSave(url, r.data, r.headers, 'crawler', attempt);
      } catch (e: any) {
        this.logger.warn(`crawler attempt ${attempt} failed: ${e.message}`);
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }
    throw new Error('refresh failed after 5 attempts');
  }
```

- [ ] **Step 2: Verify syntax and build**

Run: `pnpm run build`
Expected: Build completes successfully

- [ ] **Step 3: Commit**

```bash
git add src/modules/subscribe/subscribe.service.ts
git commit -m "refactor: crawler branch uses validateAndSave"
```

---

### Task 5: Update refreshForced method

**Files:**
- Modify: `src/modules/subscribe/subscribe.service.ts:90-113` (refreshForced method)

- [ ] **Step 1: Replace refreshForced logic**

Current lines 90-113:

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

Replace with:

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
        return await this.validateAndSave(url, r.data, r.headers, 'crawler', attempt);
      } catch (e: any) {
        this.logger.warn(`refreshForced attempt ${attempt} failed: ${e.message}`);
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }
    throw new Error('refreshForced failed after 5 attempts');
  }
```

- [ ] **Step 2: Verify syntax and build**

Run: `pnpm run build`
Expected: Build completes successfully

- [ ] **Step 3: Commit**

```bash
git add src/modules/subscribe/subscribe.service.ts
git commit -m "refactor: refreshForced uses validateAndSave"
```

---

### Task 6: Final build and functional verification

**Files:**
- Verify: `src/modules/subscribe/subscribe.service.ts`

- [ ] **Step 1: Full build verification**

Run: `pnpm run build`
Expected: Build completes with no TypeScript errors

- [ ] **Step 2: Verify method order in final file**

Final file should have methods in this order:
1. `countProxies()` - existing
2. `validateAndSave()` - new
3. `refresh()` - modified
4. `refreshForced()` - modified
5. `checkTrafficFromHeaders()` - existing
6. `checkAndNotifyTraffic()` - existing
7. `notifyEmptyNodes()` - new
8. `getLatestYaml()` - existing
9. ... rest unchanged

- [ ] **Step 3: Commit build verification**

```bash
git status
# Should show nothing to commit - all changes already committed
```

---

## Plan Self-Review ✅

**1. Spec coverage:**
- ✅ Node count validation before save - Task 2
- ✅ Email notification on zero nodes - Task 1
- ✅ Don't overwrite old data - Task 2 (throws before save)
- ✅ Meta URL branch - Task 3
- ✅ Crawler branch - Task 4
- ✅ refreshForced() - Task 5
- ✅ Headers missing only logs warning, doesn't block - preserved in `checkTrafficFromHeaders`

**2. Placeholder scan:**
- ✅ No TBD/TODO
- ✅ All code blocks complete
- ✅ All commands with expected output

**3. Consistency check:**
- ✅ Method `notifyEmptyNodes()` named consistently
- ✅ `validateAndSave()` parameters match across all call sites
- ✅ Source strings: 'meta-url' and 'crawler' used consistently
- ✅ Attempt parameter passed correctly from loops
