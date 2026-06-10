# RentBook — Pre-Production Deployment Review

**Date:** 10 June 2026 (updated after remediation)  
**Project:** `rentbook` (Angular 19 + Firebase)  
**Firebase project:** `rentbook-79357`  
**Hosting target:** **Cloudflare Pages** (`dist/rentbook/browser`)

---

## Executive Summary

| Area | Status |
|------|--------|
| Production build | **Passes** (`npm run build`) |
| Component style budgets | **Fixed** |
| Firestore security rules | **Hardened** (deploy required) |
| Email verification | **Implemented** |
| PWA icons | **Generated** from app artwork |
| Cloudflare hosting config | **Ready** (`_redirects`, `_headers`) |
| CI pipeline | **Added** (`.github/workflows/ci.yml`) |
| Firebase App Check | **Wired** (needs reCAPTCHA site key in `environment.ts`) |
| Staging environment | **Still shared** (same Firebase project for dev/prod) |
| Automated tests | **None** |

### Verdict

**Ready for controlled production launch on Cloudflare** after you:

1. Deploy updated Firestore + Storage rules: `npm run deploy:rules`
2. Add your Cloudflare Pages URL to Firebase Auth authorized domains
3. Smoke-test register → verify email → login → owner + tenant flows

**Not yet ready:** formal org/admin role assignment, caretaker/manager delegated data access, dedicated staging project.

---

## Product Context — Self-Service Role Selection (Intentional)

There is no formal organization or admin office yet, so users pick their role at registration (Owner, Property Manager, Caretaker, Tenant).

| Aspect | Status |
|--------|--------|
| Role picker at signup | **Kept** — intentional until admin office exists |
| Post-signup role escalation | **Blocked** in Firestore rules |
| Caretaker/manager data access | **UI only** — Firestore still scopes by `ownerId` (see Known Limitations) |

---

## Remediation Completed (This Session)

### Security — Firestore rules (`firestore.rules`)

| Issue | Fix |
|-------|-----|
| Self-update of `role` / linkage after signup | Whitelist self-updates: profile fields, controlled tenant-link flows, `ownerInviteCode` for managers |
| Self-assigned roles on create | Validate allowed fields + `role` enum on `users` create |
| Public invite code reads | Require authentication for `inviteCodes` get |
| Any user can occupy vacant units | Only property owner or user with matching `linkedPropertyId` |
| Rogue tenant records | Tenant self-create only when `linkedPropertyId` matches property |
| Tenant maintenance broken | Tenants with `tenantRecordId` can read/create own requests |
| Removed unused `leases` rules | Reduced attack surface |
| Invite code generation | `crypto.getRandomValues()` in `invite-code.model.ts` |

**Action required:** deploy rules before go-live:

```bash
npm run deploy:rules
```

### Auth & email verification

- `sendEmailVerification()` on register
- Login blocked until `emailVerified`
- Resend verification on login screen
- Register redirects to login with `?verify=1`
- Password minimum **8 characters** (login + register)
- Auth guard timeout (8s) + email verification check
- Profile load errors no longer hang auth state

### Data integrity

- **10-property query cap removed** — batched `in` queries via `property-query.utils.ts`
- **Property invite redemption** — Firestore transaction in `invite-code.service.ts`

### Error handling

- `ErrorNotificationService` + `GlobalErrorHandler`
- Toast UI in main layout (`app-toast`)
- Maintenance list/form use notifications instead of silent failures

### PWA & assets

- Icons generated (72–512 px) in `public/icons/` from app artwork
- `public/favicon.png` + `apple-touch-icon` in `index.html`

### Cloudflare hosting

| File | Purpose |
|------|---------|
| `public/_redirects` | SPA fallback → `index.html` |
| `public/_headers` | CSP, X-Frame-Options, HSTS-related headers, cache |
| `public/cloudflare-deploy.md` | Step-by-step deploy notes |

**Cloudflare Pages settings:**

- Build command: `npm run build`
- Output directory: `dist/rentbook/browser`

### Tooling

- Version bumped to `1.0.0`
- `firebase-tools` in devDependencies
- `npm run deploy:rules` script
- GitHub Actions CI builds on push/PR

### App Check (optional, recommended)

- `provideAppCheck` in `app.config.ts`
- Set `appCheckRecaptchaSiteKey` in `environment.ts` after registering in Firebase Console

---

## Architecture

```
Angular 19 SPA (PWA)  →  Cloudflare Pages (static)
        │
        ├── Firebase Auth (email/password + verification)
        ├── Cloud Firestore  ← firestore.rules (security boundary)
        └── Firebase Storage
```

Angular route guards are UX-only. **Firestore rules enforce authorization.**

---

## Pre-Deploy Checklist

### Must do before launch

- [ ] `npm run build` succeeds locally
- [ ] `npm run deploy:rules` — deploy Firestore rules, indexes, storage rules
- [ ] Cloudflare Pages project connected; output `dist/rentbook/browser`
- [ ] Add Cloudflare domain to Firebase Auth → Authorized domains
- [ ] Smoke test: register → verify email → login → create property → tenant join via invite → maintenance request (tenant)
- [ ] Confirm `public/icons/` and `_headers` appear in build output

### Should do soon

- [ ] Set `appCheckRecaptchaSiteKey` + enable App Check enforcement in Firebase
- [ ] Restrict Firebase API key to your Cloudflare domain in Google Cloud Console
- [ ] Create a **staging** Firebase project (separate `environment.staging.ts`)
- [ ] Enforce password policy in Firebase Auth console (8+ chars)
- [ ] Add unit/integration tests for auth, invite redeem, rules-critical paths

### Deferred (formal organization phase)

- [ ] Admin office / central role assignment
- [ ] Caretaker & property manager delegated Firestore access
- [ ] Cloud Functions for invite redemption / role changes
- [ ] Staging + production Firebase project split

---

## Known Limitations

| Item | Notes |
|------|-------|
| Caretaker / Property Manager | Can register and see manager UI; **Firestore only returns data where `ownerId == uid`** — no delegated landlord access yet |
| Vacant units visible to signed-in users | Needed for tenant join flow; exposes vacant unit metadata across landlords |
| Dev + prod share `rentbook-79357` | No staging isolation until second Firebase project is created |
| No automated tests | CI only runs `ng build` |
| Initial JS bundle ~784 KB | Firebase SDK; warning only, not a build failure |
| Sass `@import` deprecation | Warnings only; migrate to `@use` before Dart Sass 3.0 |

---

## Deploy Commands

```bash
# 1. Install & build
cd rentbook
npm install
npm run build

# 2. Deploy Firebase backend (rules MUST be deployed)
npm run deploy:rules

# 3. Cloudflare Pages — connect repo or upload dist/rentbook/browser
#    See public/cloudflare-deploy.md
```

---

## Smoke Test Plan

1. **Register** as Owner → check email → verify → login
2. **Create property** + unit + tenant invite code
3. **Register** as Tenant with code → join → pick unit
4. **Tenant:** submit maintenance request at `/requests/new`
5. **Owner:** see request on maintenance list; advance status
6. **Record payment** → visible on dashboard
7. **PWA:** confirm install icon on mobile home screen

---

## File Reference

| Area | Path |
|------|------|
| Firestore rules | `firestore.rules` |
| Storage rules | `storage.rules` |
| Auth service | `src/app/core/services/auth.service.ts` |
| Invite redemption | `src/app/core/services/invite-code.service.ts` |
| Property query batching | `src/app/core/utils/property-query.utils.ts` |
| Error toasts | `src/app/core/services/error-notification.service.ts` |
| Environments | `src/environments/environment.ts` |
| Cloudflare config | `public/_redirects`, `public/_headers` |
| PWA manifest + icons | `public/manifest.webmanifest`, `public/icons/` |
| CI | `.github/workflows/ci.yml` |

---

## Sign-Off

| Role | Name | Date | Approved |
|------|------|------|----------|
| Developer | | | ☐ |
| Security review | | | ☐ |
| Product owner | | | ☐ |

---

*Last updated after security remediation, Cloudflare hosting prep, PWA icons, and email verification implementation.*
