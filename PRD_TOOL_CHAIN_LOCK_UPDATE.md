# PRD Tool Chain Lock Update - 2026-01-31

## Overview

The Voxanne AI PRD has been updated to enforce immutability of the tool chain configuration. This document summarizes all changes made to prevent accidental modifications that could break the outbound calling pipeline.

---

## Changes Made to PRD

### 1. ✅ Added New Section: "TOOL CHAIN IMMUTABILITY POLICY" (Top of Document)

**Location:** Immediately after version header
**Size:** ~300 lines
**Content:**
- Effective date and immutability status
- Comprehensive table of locked components
- Modification procedure (formal approval required)
- Warning signs of unsafe changes
- Critical invariants reference
- Links to `.claude/CLAUDE.md`

**Key Points:**
- 5 tools are LOCKED (exactly, no additions/removals)
- Tool names are LOCKED
- Tool order is LOCKED
- Server URLs must use `resolveBackendUrl()`
- `vapi_phone_number_id` writes cannot be removed
- All modifications require explicit approval process

---

### 2. ✅ Added New Section: "TOOL CHAIN STATUS & DEVELOPER REFERENCE"

**Location:** After "CLAUDE.md Protection Rules" section
**Size:** ~350 lines
**Content:**
- Current implementation status
- All 5 tools table with IDs and status
- Critical files that cannot be modified without approval
- What developers CAN do (bug fixes, logging, etc.)
- What developers CANNOT do (list of forbidden changes)
- Quick start guide for new developers
- Common questions & answers with firm "No" responses

**Key Features:**
- Specific file references with line numbers
- Q&A section addressing common requests
- Quick reference for developers
- Links to critical invariants

---

### 3. ✅ Updated Version Number

**From:** version 2026.9
**To:** version 2026.9.1 (Tool Chain Locked)

**Status Line Updated:**
```
Status: 🚀 PRODUCTION READY - Live at https://voxanne.ai with PWA Support & Mobile-First Design
Tool Chain Status: 🔒 LOCKED - All 5 tools registered, linked, and immutable.
```

---

### 4. ✅ Removed Conflicting Open Question

**Removed:** "Tool Coverage: Are there additional tools beyond `bookClinicAppointment` that need to be registered?"
**Replaced With:** Clear note stating tool coverage is NOT an open question and requires formal approval

---

### 5. ✅ Updated Medium-Term Roadmap

**Removed:** "Additional Tools: Extend beyond `bookClinicAppointment` to support `rescheduleAppointment`, `cancelAppointment`, etc."
**Replaced With:** Note stating the 5-tool suite is locked and any changes require formal approval process

---

### 6. ✅ Updated Long-Term Roadmap

**Section:** "Multi-Provider Support"
**Change:** Added explicit note that any multi-provider support would require SEPARATE tool chains, and current Vapi tools remain locked
**Note:** Clarified that approval process from "TOOL CHAIN IMMUTABILITY POLICY" applies

---

## Files Modified

| File | Change | Status |
|------|--------|--------|
| `.agent/prd.md` | Added immutability policy, removed conflicting logic | ✅ COMPLETE |

---

## Content Additions Summary

### Added ~650 lines of locked policy enforcement:
- TOOL CHAIN IMMUTABILITY POLICY section (~300 lines)
- TOOL CHAIN STATUS & DEVELOPER REFERENCE section (~350 lines)

### Removed/Updated:
- ❌ Removed "Tool Coverage" open question
- ❌ Removed "Additional Tools" from roadmap
- ✅ Updated "Multi-Provider Support" with lock clarification
- ✅ Updated version number to reflect lock status

---

## Protection Mechanisms in Place

### 1. **Explicit Prohibition**
- Clear statement: Tools are LOCKED
- Table showing what is locked
- Formal approval process required for changes

### 2. **Developer Guidance**
- What developers CAN do (safe changes)
- What developers CANNOT do (forbidden changes)
- Quick start guide explaining the tool chain

### 3. **Q&A Section**
- Common questions answered with firm "No"
- References to approval process
- Explanations of why certain changes break things

### 4. **Cross-References**
- Links to `.claude/CLAUDE.md` critical invariants (6 rules)
- References to critical files
- Specific line numbers for modifications

### 5. **Version Control**
- Version updated to 2026.9.1 (Tool Chain Locked)
- Clear status line indicating lock status
- Effective date: 2026-01-31

---

## Approval Process for Future Changes

Any future modifications to the tool chain must follow this process:

1. **Create an Issue** with:
   - Why the change is necessary
   - What components need to change
   - Impact analysis
   - Migration plan

2. **Design Review** with:
   - Senior Engineer
   - Product Lead
   - QA Lead

3. **Implementation** with:
   - Data migration for all orgs
   - E2E tests
   - Rollback procedure
   - Backward compatibility plan

4. **Deployment** with:
   - Staging test (48 hours)
   - Feature flag
   - Monitoring
   - Incident response plan

5. **Post-Deployment**:
   - Update PRD
   - Update `.claude/CLAUDE.md`
   - Notify team
   - Document in CHANGELOG.md

---

## Critical Invariants Reference

The PRD now prominently references `.claude/CLAUDE.md` which contains 6 CRITICAL INVARIANT RULES:

1. **Never remove `vapi_phone_number_id`** from agent-sync writes
2. **Never change `.maybeSingle()` back to `.single()`** on agent queries
3. **Never pass raw phone strings** as Vapi `phoneNumberId`
4. **Never remove phone number auto-resolution** fallback
5. **Never remove pre-flight assertion** in `createOutboundCall()`
6. **Never auto-recreate Vapi assistants** in error handlers

All AI assistants and developers MUST follow these rules.

---

## Impact

### For Developers:
- ✅ Clear understanding of what is locked
- ✅ Explicit approval process for changes
- ✅ Quick reference guide for common tasks
- ✅ Firm but fair policy on forbidden changes

### For AI Assistants:
- ✅ Cannot accidentally suggest adding tools
- ✅ Directed to formal approval process for changes
- ✅ Clear warnings about breaking changes
- ✅ Multiple references to critical files

### For Product:
- ✅ Tool chain stability guaranteed
- ✅ Prevents accidental breaking changes
- ✅ Clear process for future enhancements
- ✅ Version control and documentation

---

## Verification

To verify the PRD updates are in place:

```bash
# Check for TOOL CHAIN IMMUTABILITY POLICY section
grep -n "TOOL CHAIN IMMUTABILITY POLICY" .agent/prd.md

# Check that "Additional Tools" is removed/updated
grep "Additional Tools" .agent/prd.md | grep -v "status"

# Check for new DEVELOPER REFERENCE section
grep -n "TOOL CHAIN STATUS & DEVELOPER REFERENCE" .agent/prd.md

# Verify version number
head -1 .agent/prd.md | grep "2026.9.1"
```

---

## Document Control

- **Document:** PRD Tool Chain Lock Update
- **Date:** 2026-01-31
- **Status:** COMPLETE
- **Approval:** PRD Updated
- **Owner:** Development Team
- **Effective:** Immediately

---

**The Voxanne AI tool chain is now protected by explicit policy in the master PRD. No AI or developer can modify the tool chain without going through the formal approval process documented above.**
