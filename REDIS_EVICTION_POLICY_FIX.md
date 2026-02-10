# Redis Eviction Policy Fix (CRITICAL)

**Status:** ⚠️ **PRODUCTION ISSUE - Immediate Action Required**
**Date:** 2026-02-10
**Severity:** HIGH (Data Loss Risk)

---

## 🚨 Problem

Production logs show 16+ warnings on every server restart:

```
IMPORTANT! Eviction policy is allkeys-lru. It should be "noeviction"
```

**What This Means:**
- Current policy: `allkeys-lru` (Least Recently Used eviction)
- Redis **WILL DELETE** job queue data when memory is full
- **HIGH RISK** of losing webhook jobs, billing jobs, wallet jobs, SMS jobs

**Impact:**
- Lost webhook events = missed call data, broken appointment bookings
- Lost billing jobs = revenue loss, incorrect charges
- Lost wallet jobs = failed auto-recharges
- Lost SMS jobs = customers don't receive messages

---

## ✅ Solution (3 Options)

### Option 1: Fix in Render Dashboard (RECOMMENDED)

**If using Render Redis:**

1. Navigate to [Render Dashboard](https://dashboard.render.com)
2. Select your Redis instance
3. Click **Settings** tab
4. Scroll to **Advanced Settings**
5. Find **Eviction Policy** dropdown
6. Change from `allkeys-lru` → **`noeviction`**
7. Click **Save Changes**
8. Restart your backend service

**Why `noeviction`?**
- Redis returns errors when memory is full instead of deleting data
- BullMQ can handle "out of memory" errors gracefully (retries later)
- BullMQ **CANNOT** handle lost jobs (permanent data loss)

---

### Option 2: Fix in Upstash Dashboard

**If using Upstash Redis:**

1. Navigate to [Upstash Console](https://console.upstash.com)
2. Select your Redis database
3. Click **Configuration** tab
4. Find **Eviction Policy** section
5. Select **`noeviction`**
6. Click **Update Configuration**
7. Restart your backend service

---

### Option 3: Fix via Redis CLI (Any Provider)

**If you have direct Redis access:**

```bash
# Connect to Redis
redis-cli -u $REDIS_URL

# Check current policy
CONFIG GET maxmemory-policy
# Output: "allkeys-lru"

# Set noeviction policy
CONFIG SET maxmemory-policy noeviction

# Verify change
CONFIG GET maxmemory-policy
# Output: "noeviction"

# Make persistent (survive restarts)
CONFIG REWRITE
```

---

## 🧪 Verification

After applying the fix, restart your backend and check logs:

**Before (BROKEN):**
```
IMPORTANT! Eviction policy is allkeys-lru. It should be "noeviction"
IMPORTANT! Eviction policy is allkeys-lru. It should be "noeviction"
... (16+ warnings)
```

**After (FIXED):**
```
✅ Webhook queue initialized
✅ Webhook worker started
✅ Billing queue initialized
✅ Wallet queue initialized
✅ SMS queue initialized
(NO warnings about eviction policy)
```

---

## 📊 Why This Matters

### Job Queue Architecture

We run 4+ BullMQ job queues in production:

| Queue | Purpose | Frequency | Risk if Lost |
|-------|---------|-----------|--------------|
| Webhook Processing | Process Vapi call events | Every call | Lost call data, broken bookings |
| Billing Jobs | Stripe webhook processing | Per transaction | Revenue loss |
| Wallet Jobs | Auto-recharge processing | Daily | Failed payments |
| SMS Jobs | Text message sending | Per message | Customers miss messages |

### Eviction Policy Comparison

| Policy | Behavior | Safe for Queues? |
|--------|----------|------------------|
| `allkeys-lru` | Deletes least recently used keys when full | ❌ NO - Deletes jobs |
| `volatile-lru` | Deletes expired keys when full | ❌ NO - Jobs have no expiry |
| `allkeys-random` | Deletes random keys when full | ❌ NO - Random job loss |
| **`noeviction`** | **Returns error when full, NO deletion** | ✅ **YES - Safe** |

---

## 🔍 Why 16 Warnings?

BullMQ checks the eviction policy **for each queue/worker** during initialization:

1. Webhook queue connection
2. Webhook worker connection
3. Billing queue connection
4. Billing worker connection
5. Wallet queue connection
6. Wallet worker connection
7. SMS queue connection
8. SMS worker connection
9. Additional worker connections...

**Total:** 16+ separate Redis connections, each printing the warning.

---

## 🚀 Expected Outcome

After fixing the eviction policy:

✅ **Zero warnings** on server startup
✅ **Job queue reliability** guaranteed
✅ **No data loss** when Redis memory is full
✅ **Production-ready** job queue architecture
✅ **BullMQ best practices** compliance

---

## 📝 Alternative: Increase Redis Memory

If you can't change eviction policy (restricted Redis provider):

1. **Increase Redis memory size** (upgrade plan)
2. **Monitor memory usage** closely
3. **Set up alerts** for 80% memory usage
4. **Implement job cleanup** (remove old completed jobs faster)

**However:** This is a temporary fix. Proper eviction policy is still required.

---

## 🔗 References

- [BullMQ Redis Configuration](https://docs.bullmq.io/guide/connections#redis-configuration)
- [Redis Eviction Policies](https://redis.io/docs/manual/eviction/)
- [Render Redis Documentation](https://render.com/docs/redis)

---

## ✅ Action Checklist

- [ ] Access Redis dashboard (Render/Upstash/Other)
- [ ] Change eviction policy to `noeviction`
- [ ] Save configuration
- [ ] Restart backend service
- [ ] Verify no warnings in production logs
- [ ] Monitor Redis memory usage
- [ ] Set up alerts for 80% memory threshold
- [ ] Document change in changelog

---

**Priority:** 🔴 **CRITICAL - Fix within 24 hours**
**Risk Level:** HIGH - Data loss possible under high load
**Effort:** 5 minutes (configuration change only)
