# Repository Reorganization Plan
## CallWaiting AI - Single Source of Truth Structure

**Date:** January 10, 2026  
**Status:** Planning Phase

---

## Problem Statement

The current repository structure is scattered with:
- 100+ markdown documentation files in the root directory
- Mixed frontend/backend code organization
- Configuration files spread across root and subdirectories
- No clear separation between documentation, source code, and infrastructure
- Difficult to maintain and navigate

**Goal:** Reorganize into a clean, maintainable structure following industry best practices with single source of truth for backend and frontend.

---

## Best Practices for Repository Organization

### 1. **Monorepo Structure (Recommended for Full-Stack Apps)**
```
callwaiting-ai/
├── apps/
│   ├── frontend/          # Next.js frontend (single source of truth)
│   └── backend/           # Express backend (single source of truth)
├── packages/              # Shared code (types, utils)
├── docs/                  # All documentation
├── infrastructure/        # Docker, deployment configs
├── scripts/               # Build, deploy, utility scripts
└── root files             # README, package.json (workspace), .gitignore
```

### 2. **Standard Structure (Current Approach - Simpler)**
```
callwaiting-ai/
├── backend/               # Backend source (single source of truth)
│   ├── src/              # Source code
│   ├── tests/            # Backend tests
│   ├── docs/             # Backend-specific docs
│   └── config/           # Backend configs
├── frontend/             # Frontend source (single source of truth)
│   ├── src/              # Source code
│   ├── public/           # Static assets
│   └── docs/             # Frontend-specific docs
├── docs/                 # Project-wide documentation
├── infrastructure/       # Docker, deployment configs
├── scripts/              # Shared scripts
└── root files            # README, workspace configs
```

**Decision: Use Standard Structure** (matches current setup, easier migration)

---

## Implementation Phases

### Phase 1: Backend Organization
**Goal:** Consolidate all backend-related files into `backend/` directory

**Steps:**
1. Move backend documentation files from root to `backend/docs/`
2. Move backend scripts from root to `backend/scripts/` (if not already there)
3. Consolidate backend configuration files
4. Create `backend/README.md` with structure documentation
5. Update import paths if needed

**Files to Move:**
- Backend-related `.md` files (identify by content/name)
- Backend configuration files (render.yaml, etc.)
- Backend scripts from root `scripts/` directory

**Acceptance Criteria:**
- ✅ All backend files are in `backend/` directory
- ✅ No backend-related files in root
- ✅ Backend can start and run correctly
- ✅ Import paths work correctly

---

### Phase 2: Frontend Organization
**Goal:** Consolidate all frontend-related files into root (Next.js convention)

**Steps:**
1. Ensure `src/` contains all frontend source code
2. Ensure `public/` contains all static assets
3. Move frontend-specific documentation to `docs/frontend/`
4. Consolidate frontend configuration files in root
5. Create/update `README.md` with frontend structure

**Files to Organize:**
- Frontend components, pages, hooks, libs (already in `src/`)
- Frontend-specific configs (next.config.mjs, tailwind.config.ts)
- Frontend scripts

**Acceptance Criteria:**
- ✅ All frontend source code in `src/` directory
- ✅ All frontend configs in root (Next.js convention)
- ✅ Frontend builds and runs correctly
- ✅ No broken imports

---

### Phase 3: Documentation Organization
**Goal:** Consolidate all documentation into `docs/` directory

**Steps:**
1. Create `docs/` directory structure:
   ```
   docs/
   ├── architecture/      # Architecture docs
   ├── deployment/        # Deployment guides
   ├── development/       # Dev setup, guides
   ├── features/          # Feature documentation
   ├── api/              # API documentation
   ├── frontend/         # Frontend-specific docs
   ├── backend/          # Backend-specific docs (link/sync with backend/docs)
   └── README.md         # Documentation index
   ```
2. Move all `.md` files from root to appropriate `docs/` subdirectories
3. Create documentation index in `docs/README.md`
4. Update all references to moved documentation files

**Files to Move:**
- ~100 markdown files from root
- Categorize by: architecture, deployment, features, etc.

**Acceptance Criteria:**
- ✅ No documentation files in root (except README.md)
- ✅ All docs organized in `docs/` with clear structure
- ✅ Documentation index created
- ✅ All internal links updated

---

### Phase 4: Infrastructure & Scripts Organization
**Goal:** Organize infrastructure and scripts

**Steps:**
1. Create `infrastructure/` directory for:
   - Docker files
   - Deployment configs (render.yaml, vercel.json, etc.)
   - Environment template files
2. Organize `scripts/` directory:
   - Backend scripts → `backend/scripts/`
   - Frontend scripts → `scripts/frontend/` or keep in root
   - Shared scripts → `scripts/shared/`
3. Update all script references

**Acceptance Criteria:**
- ✅ Infrastructure files organized
- ✅ Scripts categorized and documented
- ✅ All script paths updated

---

### Phase 5: Cleanup & Validation
**Goal:** Final cleanup and validation

**Steps:**
1. Remove temporary files and duplicates
2. Update `.gitignore` if needed
3. Update root `README.md` with new structure
4. Test full application (frontend + backend)
5. Update deployment scripts if needed
6. Create migration guide for team

**Acceptance Criteria:**
- ✅ No duplicate files
- ✅ No temporary/debug files in repo
- ✅ Application runs end-to-end
- ✅ All team documentation updated
- ✅ Git history preserved (using git mv)

---

## Technical Requirements

### Tools Needed:
- `git mv` for preserving file history
- File search to find references
- Shell scripts for bulk operations

### Dependencies:
- All imports must be updated
- Deployment configs must reference new paths
- CI/CD pipelines must be updated

### Constraints:
- Must preserve Git history (use `git mv`, not `mv` + `git add`)
- Must not break running applications
- Must maintain backward compatibility during transition

---

## Testing Strategy

### After Each Phase:
1. **Backend Tests:**
   - ✅ Server starts successfully
   - ✅ All routes accessible
   - ✅ Database connections work
   - ✅ Environment variables load correctly

2. **Frontend Tests:**
   - ✅ Application builds successfully
   - ✅ All pages load correctly
   - ✅ No broken imports
   - ✅ Static assets load

3. **Integration Tests:**
   - ✅ Frontend can connect to backend
   - ✅ API endpoints work
   - ✅ WebSocket connections work

### Final Validation:
- ✅ Full application workflow test
- ✅ Deployment test (if possible)
- ✅ Documentation links verified
- ✅ No broken references

---

## Risk Mitigation

### Risk 1: Broken Imports
**Mitigation:** Use TypeScript compiler to catch import errors, test thoroughly

### Risk 2: Deployment Failures
**Mitigation:** Test deployment configs, update paths in CI/CD

### Risk 3: Lost Git History
**Mitigation:** Always use `git mv` instead of `mv` + `git add`

### Risk 4: Team Confusion
**Mitigation:** Create clear migration guide, update README early

---

## Success Criteria

- ✅ Backend code is 100% in `backend/` directory
- ✅ Frontend code is 100% in `src/` directory (Next.js convention)
- ✅ All documentation is in `docs/` directory
- ✅ No scattered files in root directory
- ✅ Application runs without errors
- ✅ All team members can navigate structure easily
- ✅ Git history is preserved
- ✅ Deployment works correctly

---

## Estimated Timeline

- **Phase 1 (Backend):** 30 minutes
- **Phase 2 (Frontend):** 20 minutes
- **Phase 3 (Documentation):** 45 minutes (100+ files to organize)
- **Phase 4 (Infrastructure):** 15 minutes
- **Phase 5 (Cleanup):** 20 minutes

**Total:** ~2.5 hours

---

## Next Steps

1. Review and approve this plan
2. Create backup branch: `git checkout -b backup-before-reorganization`
3. Begin Phase 1 execution
