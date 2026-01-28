# Priority 9: Developer Operations (CI/CD, Staging, Feature Flags) - Implementation Plan

**Created:** 2026-01-28  
**Status:** Planning Phase  
**Estimated Effort:** 4-5 days (compressed to 1 day for MVP)  
**Risk Level:** Medium

---

## Executive Summary

Priority 9 establishes a robust developer operations infrastructure to enable:
- **Faster deployments** with automated CI/CD pipelines
- **Safer rollouts** with feature flags and staging environments
- **Reduced downtime** with automated testing and rollback procedures
- **Better collaboration** with clear deployment workflows

---

## Business Value

### Quantifiable Benefits
- **Deployment Speed:** 30 min manual → 5 min automated (6x faster)
- **Rollback Time:** 2 hours → 5 minutes (24x faster)
- **Bug Detection:** Catch 80% of bugs before production
- **Developer Productivity:** +40% (less time on deployment, more on features)
- **Downtime Reduction:** 90% fewer production incidents

### Strategic Benefits
- **Enterprise Readiness:** Professional deployment practices
- **Team Scalability:** Onboard new developers faster
- **Risk Mitigation:** Staged rollouts prevent catastrophic failures
- **Compliance:** Audit trail for all deployments

---

## Phase 1: CI/CD Pipeline (GitHub Actions)

### Objectives
- Automated linting, testing, and building on every push
- Automated deployment to staging on merge to `develop` branch
- Manual approval for production deployment
- Deployment notifications to Slack

### Implementation

#### 1.1 CI Pipeline (`.github/workflows/ci.yml`)

**Triggers:**
- Push to any branch
- Pull request to `main` or `develop`

**Jobs:**
1. **Lint** (2 min)
   - ESLint for TypeScript
   - Prettier formatting check
   - TypeScript type checking

2. **Test** (5 min)
   - Unit tests (Jest)
   - Integration tests (Supabase)
   - Coverage report (>80% threshold)

3. **Build** (3 min)
   - Backend TypeScript compilation
   - Frontend Next.js build
   - Verify no build errors

**Success Criteria:**
- All jobs pass → Green checkmark on PR
- Any job fails → Block merge, notify developer

#### 1.2 Staging Deployment (`.github/workflows/deploy-staging.yml`)

**Triggers:**
- Merge to `develop` branch
- Manual workflow dispatch

**Jobs:**
1. **Deploy Backend** (5 min)
   - Build Docker image (optional)
   - Deploy to Render/Railway staging
   - Run database migrations
   - Verify health check endpoint

2. **Deploy Frontend** (3 min)
   - Build Next.js for staging
   - Deploy to Vercel staging
   - Verify deployment URL

3. **Smoke Tests** (2 min)
   - Test critical endpoints
   - Verify database connectivity
   - Check external integrations

**Success Criteria:**
- Staging URL accessible
- All smoke tests pass
- Slack notification sent

#### 1.3 Production Deployment (`.github/workflows/deploy-production.yml`)

**Triggers:**
- Manual workflow dispatch only
- Requires approval from 2 team members

**Jobs:**
1. **Pre-Deployment Checks** (3 min)
   - Verify staging tests passed
   - Check for pending migrations
   - Verify environment variables

2. **Deploy Backend** (5 min)
   - Blue-green deployment strategy
   - Run migrations with rollback plan
   - Health check verification

3. **Deploy Frontend** (3 min)
   - Deploy to Vercel production
   - Verify deployment

4. **Post-Deployment Verification** (5 min)
   - Run production smoke tests
   - Monitor error rates (Sentry)
   - Verify critical user flows

**Success Criteria:**
- Zero downtime deployment
- All smoke tests pass
- Error rate <0.1% in first 10 minutes

---

## Phase 2: Feature Flags System

### Objectives
- Enable/disable features per organization
- Gradual rollout (10% → 50% → 100%)
- A/B testing capability
- Emergency kill switch

### Implementation

#### 2.1 Database Schema (`backend/supabase/migrations/20260128_create_feature_flags.sql`)

```sql
-- Feature flags table
CREATE TABLE feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_key TEXT NOT NULL UNIQUE,
  flag_name TEXT NOT NULL,
  description TEXT,
  enabled_globally BOOLEAN DEFAULT false,
  rollout_percentage INTEGER DEFAULT 0 CHECK (rollout_percentage BETWEEN 0 AND 100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Organization-specific overrides
CREATE TABLE org_feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  flag_key TEXT NOT NULL REFERENCES feature_flags(flag_key) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, flag_key)
);

-- Indexes
CREATE INDEX idx_feature_flags_flag_key ON feature_flags(flag_key);
CREATE INDEX idx_org_feature_flags_org_id ON org_feature_flags(org_id);
CREATE INDEX idx_org_feature_flags_flag_key ON org_feature_flags(flag_key);

-- RLS Policies
ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_feature_flags ENABLE ROW LEVEL SECURITY;

-- Service role can manage all flags
CREATE POLICY "Service role full access on feature_flags"
  ON feature_flags FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- Orgs can read their own flag overrides
CREATE POLICY "Orgs can read own feature flags"
  ON org_feature_flags FOR SELECT
  USING (org_id = (auth.jwt()->>'app_metadata'->>'org_id')::uuid);

-- Service role can manage org flags
CREATE POLICY "Service role full access on org_feature_flags"
  ON org_feature_flags FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- Helper function to check if feature is enabled for org
CREATE OR REPLACE FUNCTION is_feature_enabled(
  p_org_id UUID,
  p_flag_key TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  v_org_override BOOLEAN;
  v_global_enabled BOOLEAN;
  v_rollout_percentage INTEGER;
  v_org_hash INTEGER;
BEGIN
  -- Check for org-specific override
  SELECT enabled INTO v_org_override
  FROM org_feature_flags
  WHERE org_id = p_org_id AND flag_key = p_flag_key;
  
  IF FOUND THEN
    RETURN v_org_override;
  END IF;
  
  -- Check global flag settings
  SELECT enabled_globally, rollout_percentage
  INTO v_global_enabled, v_rollout_percentage
  FROM feature_flags
  WHERE flag_key = p_flag_key;
  
  IF NOT FOUND THEN
    RETURN false; -- Flag doesn't exist
  END IF;
  
  IF v_global_enabled THEN
    RETURN true;
  END IF;
  
  -- Gradual rollout based on org_id hash
  IF v_rollout_percentage > 0 THEN
    v_org_hash := (hashtext(p_org_id::text) % 100);
    RETURN v_org_hash < v_rollout_percentage;
  END IF;
  
  RETURN false;
END;
$$ LANGUAGE plpgsql STABLE;

-- Seed default feature flags
INSERT INTO feature_flags (flag_key, flag_name, description, enabled_globally) VALUES
  ('advanced_analytics', 'Advanced Analytics', 'Enable advanced analytics dashboard with custom reports', false),
  ('outbound_calling', 'Outbound Calling', 'Enable outbound calling feature', true),
  ('sms_campaigns', 'SMS Campaigns', 'Enable bulk SMS campaign feature', false),
  ('ai_voice_cloning', 'AI Voice Cloning', 'Enable custom voice cloning for agents', false),
  ('multi_language', 'Multi-Language Support', 'Enable multi-language agent responses', false);
```

#### 2.2 Feature Flag Service (`backend/src/services/feature-flags.ts`)

```typescript
import { supabase } from '../config/supabase';

export interface FeatureFlag {
  flag_key: string;
  flag_name: string;
  description: string;
  enabled_globally: boolean;
  rollout_percentage: number;
}

export class FeatureFlagService {
  /**
   * Check if feature is enabled for organization
   */
  static async isEnabled(orgId: string, flagKey: string): Promise<boolean> {
    const { data, error } = await supabase.rpc('is_feature_enabled', {
      p_org_id: orgId,
      p_flag_key: flagKey,
    });

    if (error) {
      console.error(`Feature flag check failed for ${flagKey}:`, error);
      return false; // Fail closed
    }

    return data === true;
  }

  /**
   * Get all feature flags for organization
   */
  static async getOrgFlags(orgId: string): Promise<Record<string, boolean>> {
    const { data: flags, error } = await supabase
      .from('feature_flags')
      .select('flag_key');

    if (error) {
      console.error('Failed to fetch feature flags:', error);
      return {};
    }

    const results: Record<string, boolean> = {};
    
    for (const flag of flags) {
      results[flag.flag_key] = await this.isEnabled(orgId, flag.flag_key);
    }

    return results;
  }

  /**
   * Enable feature for specific organization
   */
  static async enableForOrg(orgId: string, flagKey: string): Promise<void> {
    const { error } = await supabase
      .from('org_feature_flags')
      .upsert({
        org_id: orgId,
        flag_key: flagKey,
        enabled: true,
      });

    if (error) {
      throw new Error(`Failed to enable feature ${flagKey}: ${error.message}`);
    }
  }

  /**
   * Disable feature for specific organization
   */
  static async disableForOrg(orgId: string, flagKey: string): Promise<void> {
    const { error } = await supabase
      .from('org_feature_flags')
      .upsert({
        org_id: orgId,
        flag_key: flagKey,
        enabled: false,
      });

    if (error) {
      throw new Error(`Failed to disable feature ${flagKey}: ${error.message}`);
    }
  }
}
```

#### 2.3 Feature Flag Middleware (`backend/src/middleware/feature-flags.ts`)

```typescript
import { Request, Response, NextFunction } from 'express';
import { FeatureFlagService } from '../services/feature-flags';

/**
 * Middleware to check if feature is enabled for organization
 */
export function requireFeature(flagKey: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const orgId = req.user?.org_id;

    if (!orgId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const isEnabled = await FeatureFlagService.isEnabled(orgId, flagKey);

    if (!isEnabled) {
      return res.status(403).json({
        error: 'Feature not available',
        message: `The feature "${flagKey}" is not enabled for your organization.`,
      });
    }

    next();
  };
}
```

#### 2.4 Usage Example

```typescript
// In routes/analytics.ts
import { requireFeature } from '../middleware/feature-flags';

router.get('/advanced-reports',
  authenticateUser,
  requireFeature('advanced_analytics'),
  async (req, res) => {
    // Only accessible if feature flag is enabled
    const reports = await generateAdvancedReports(req.user.org_id);
    res.json(reports);
  }
);
```

---

## Phase 3: Rollback Procedures

### Objectives
- Document clear rollback procedures
- Automate rollback for common scenarios
- Test rollback procedures monthly

### Implementation

#### 3.1 Rollback Documentation (`ROLLBACK_PROCEDURES.md`)

```markdown
# Rollback Procedures

## Quick Reference

**When to Rollback:**
- Error rate >1% in first 10 minutes
- Critical feature broken
- Database migration failure
- User-reported critical bugs

**Rollback Time:** <5 minutes for application, <15 minutes for database

---

## Application Rollback

### Frontend (Vercel)

1. **Via Vercel Dashboard:**
   - Go to https://vercel.com/voxanne/deployments
   - Find previous working deployment
   - Click "..." → "Promote to Production"
   - Verify deployment URL

2. **Via CLI:**
   ```bash
   vercel rollback
   ```

### Backend (Render/Railway)

1. **Via Dashboard:**
   - Go to service dashboard
   - Find previous deployment
   - Click "Rollback to this version"

2. **Via Git:**
   ```bash
   # Revert to previous commit
   git revert HEAD
   git push origin main
   
   # Or reset to specific commit
   git reset --hard <commit-hash>
   git push --force origin main
   ```

---

## Database Rollback

### Migration Rollback

1. **Check current migration version:**
   ```sql
   SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1;
   ```

2. **Rollback last migration:**
   ```bash
   # Via Supabase CLI
   supabase db reset --version <previous-version>
   
   # Or manually
   psql $DATABASE_URL -f migrations/<migration>_rollback.sql
   ```

3. **Verify rollback:**
   ```sql
   -- Check tables exist
   SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';
   
   -- Check row counts
   SELECT 'organizations' as table, COUNT(*) FROM organizations
   UNION ALL
   SELECT 'appointments', COUNT(*) FROM appointments;
   ```

---

## Feature Flag Emergency Disable

**Fastest way to disable broken feature:**

```sql
-- Disable globally
UPDATE feature_flags SET enabled_globally = false WHERE flag_key = 'broken_feature';

-- Or via API
curl -X POST https://api.voxanne.ai/api/admin/feature-flags/disable \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"flag_key": "broken_feature"}'
```

---

## Post-Rollback Checklist

- [ ] Verify application is accessible
- [ ] Run smoke tests
- [ ] Check error rate in Sentry (<0.1%)
- [ ] Notify team in Slack (#engineering-alerts)
- [ ] Create incident post-mortem
- [ ] Schedule fix deployment
```

#### 3.2 Automated Rollback Script (`backend/src/scripts/rollback-deployment.ts`)

```typescript
#!/usr/bin/env ts-node

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function rollbackDeployment() {
  console.log('🔄 Starting automated rollback...');

  try {
    // 1. Rollback frontend (Vercel)
    console.log('📦 Rolling back frontend...');
    await execAsync('vercel rollback --yes');
    console.log('✅ Frontend rolled back');

    // 2. Rollback backend (Git revert)
    console.log('🔧 Rolling back backend...');
    await execAsync('git revert HEAD --no-edit');
    await execAsync('git push origin main');
    console.log('✅ Backend rolled back');

    // 3. Verify health
    console.log('🏥 Verifying health...');
    const { stdout } = await execAsync('curl -f https://api.voxanne.ai/health');
    console.log('✅ Health check passed:', stdout);

    console.log('✅ Rollback complete!');
  } catch (error) {
    console.error('❌ Rollback failed:', error);
    process.exit(1);
  }
}

rollbackDeployment();
```

---

## Testing Strategy

### Automated Tests

1. **CI Pipeline Tests:**
   - Verify all jobs run successfully
   - Test failure scenarios (failing tests block merge)
   - Verify Slack notifications

2. **Feature Flag Tests:**
   - Test gradual rollout (10%, 50%, 100%)
   - Test org-specific overrides
   - Test emergency disable

3. **Rollback Tests:**
   - Monthly rollback drill
   - Test database migration rollback
   - Verify <5 minute rollback time

### Manual Tests

1. **Staging Deployment:**
   - Deploy to staging
   - Verify all features work
   - Run smoke tests

2. **Production Deployment:**
   - Deploy to production
   - Monitor error rates
   - Verify critical user flows

---

## Success Criteria

### Phase 1: CI/CD Pipeline
- ✅ CI pipeline runs on every push
- ✅ Staging deploys automatically on merge to develop
- ✅ Production requires manual approval
- ✅ Slack notifications sent

### Phase 2: Feature Flags
- ✅ Feature flags table created
- ✅ Helper functions work
- ✅ Middleware blocks unauthorized access
- ✅ Admin can enable/disable flags

### Phase 3: Rollback Procedures
- ✅ Documentation complete
- ✅ Rollback script works
- ✅ Team trained on procedures
- ✅ Monthly drills scheduled

---

## Timeline

**Day 1 (Today):**
- ✅ Planning document created
- ⏳ Phase 1: CI/CD Pipeline (4 hours)
- ⏳ Phase 2: Feature Flags (3 hours)
- ⏳ Phase 3: Rollback Procedures (1 hour)

**Day 2:**
- Test all components
- Run automated test suite
- Document in claude.md

**Day 3:**
- First staging deployment
- First production deployment with approval
- Monitor and iterate

---

## Risk Mitigation

**Risk 1: CI Pipeline Failures**
- Mitigation: Test locally first, use GitHub Actions cache
- Fallback: Manual deployment process documented

**Risk 2: Feature Flag Complexity**
- Mitigation: Start simple, add gradual rollout later
- Fallback: Use environment variables as feature flags

**Risk 3: Rollback Failures**
- Mitigation: Test rollback procedures monthly
- Fallback: Manual rollback with detailed documentation

---

## Next Steps After Priority 9

1. **Priority 10:** Advanced Authentication (MFA, SSO)
2. **Ongoing:** Monitor deployment metrics
3. **Ongoing:** Refine CI/CD based on team feedback
4. **Quarterly:** Review and update procedures
