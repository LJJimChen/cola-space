# Empty Nodes Notification Design

**Date:** 2026-05-10  
**Status:** Approved  
**Author:** Jim Chen

## Problem Statement

Currently, the refresh process can write empty node data to storage, overwriting valid previous data without notifying the user. This can cause service disruption:

1. `refreshForced()` method has no node count validation at all
2. The crawler branch in `refresh()` also lacks validation before writing
3. Empty node lists silently overwrite previously good data
4. No email notification is sent when this critical failure occurs

## Goals

1. **Prevent data loss**: Never overwrite good data with empty node lists
2. **Notify immediately**: Send email alert when no nodes are fetched
3. **Retry automatically**: Allow existing retry logic to continue after validation failure
4. **Preserve context**: Log which branch (meta URL vs crawler) failed

## Non-Goals

- No changes to `subscription-userinfo` header handling - missing info is not a fatal error
- No architectural refactoring of storage layer
- No new endpoints or API changes

## Design

### Architecture

Add validation logic in `SubscribeService` before calling `storage.saveYaml()`. This is the right layer because:

1. It has context about which branch (meta URL vs crawler) is being executed
2. It can trigger retry logic by throwing exceptions
3. It has access to the mail service for notifications
4. It follows the existing pattern (meta URL branch already has partial validation)

### Components Modified

**File:** `src/modules/subscribe/subscribe.service.ts`

1. Extract a private helper method `validateAndSave()` that:
   - Counts proxy nodes in the YAML data
   - If count is 0: sends alert email, throws error to trigger retry
   - If count > 0: calls `storage.saveYaml()` normally

2. Update all three code paths:
   - Meta URL branch in `refresh()` (line 35-59)
   - Crawler branch in `refresh()` (line 61-88)
   - `refreshForced()` method (line 90-113)

### Data Flow

```
refresh() or refreshForced()
    ↓
fetch YAML from URL
    ↓
countProxies(yaml) → 0?
    ├─ YES → sendMail(alert) → throw Error → retry/next attempt
    └─ NO → storage.saveYaml() → success
```

### Error Handling

- **Node count = 0**: Critical failure - don't save, send email, throw to trigger retry
- **Headers missing `subscription-userinfo`**: Only log warning, continue normally
- **YAML parse error**: Treat as 0 nodes, trigger same failure path

### Email Notification

**Subject:** `[Cola-Space] Critical: No nodes fetched`

**Body:**
```
Failed to fetch valid subscription data. No proxy nodes found.

Attempt: X / 5
Source: (meta URL / crawler)
URL: [the URL that was tried]

Old data has been preserved. The system will retry automatically.
```

## Implementation Plan

1. Add `notifyEmptyNodes()` helper method to send email
2. Modify existing `countProxies()` to be reusable (already exists)
3. Extract `validateAndSave()` method
4. Update meta URL branch to use the new method
5. Update crawler branch to use the new method
6. Update `refreshForced()` to use the new method
7. Test the failure path

## Testing Strategy

- Unit test: `countProxies()` returns 0 for empty/invalid YAML
- Unit test: `validateAndSave()` throws and sends email on 0 nodes
- Integration test: refresh flow retries on empty node list
- Manual test: verify email is sent when configured

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Email spam from multiple retries | Include attempt number in subject; rate limiting is handled by existing 2s delay between attempts |
| False positives (valid YAML counted as 0) | `countProxies()` already handles both `proxies` array and `proxy-groups` format; test both patterns |
| Breaking existing behavior | Validation only prevents writes; doesn't change success path |
