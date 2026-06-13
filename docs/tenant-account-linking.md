# Tenant Account Linking

How a tenant's RentBook **account** (Firebase Auth user + `users/{uid}` doc) gets connected
to the **tenant record** (`tenants/{id}`) an owner created for them.

## Background — the two ways a tenant record is created

1. **Owner adds the tenant manually** (`/tenants/new`). Creates a `tenants` doc with the
   unit, rent, and contact details but **no `userId`** (the person has no account yet).
   The unit is marked `occupied`.
2. **Tenant self-joins** with a property invite code. A `tenants` doc is created **with**
   `userId` via a transaction, and the unit is occupied at the same time.

The gap this addresses: when an owner has already done (1), and the same person later
registers an account, there was previously no way to attach the new account to the
existing record — the only option created a duplicate on a *vacant* unit.

---

## Implemented: Option A — Owner links manually (with smart suggestions)

**Status: shipped.**

Flow:

1. Owner shares their **owner invite code** with the tenant.
2. Tenant registers and enters the code → their account gets `linkedOwnerId` set and shows
   up under **"Pending assignment"** on the Tenants page.
3. In the pending card, the owner chooses between:
   - **Link tenant I added** — pick an existing unlinked tenant record from a dropdown.
   - **Create new** — the original flow (assign to a vacant unit, creating a new record).
4. When the card opens, the app **auto-suggests** a match by comparing the pending user's
   email / phone against unlinked tenant records, and pre-selects it (owner still confirms).

Key code:

- `TenantService.linkExistingTenantToUser(ownerId, userId, tenantId)` — validates ownership,
  sets `tenants/{id}.userId` (+ backfills email), and sets the user's `linkedPropertyId` +
  `tenantRecordId`.
- `TenantListComponent` — `unlinkedTenants$` / `unlinkedTenants` signal, `assignMode`
  (`'new' | 'existing'`), `selectedExistingTenantId`, `suggestExistingTenant()`.
- No Firestore rule changes were needed: owners may update their tenants' docs, and the
  `isPendingTenantAssignment` rule already allows setting `tenantRecordId` + `linkedPropertyId`
  on a connected pending user.

Limitation: the tenant must still connect via the owner code first (so the app knows they
belong to that owner).

---

## Future: Option C — Per-tenant claim code

**Status: not implemented — planned.**

Give each owner-created tenant record a **unique claim code** that the owner shares with that
one person. The tenant enters it at the join screen to claim that exact record. This removes
the manual matching step entirely and points unambiguously at a single record.

### UX

1. Owner adds a tenant → app generates a code, e.g. `TEN-4821`, shown on the tenant detail
   page with copy / WhatsApp / SMS share buttons (reuse `InviteCodeDisplayComponent`).
2. Owner sends the code to that tenant.
3. Tenant registers, opens **Join**, enters the code → the account is linked to that record.

### Suggested data model

Add to `tenants/{id}`:

```ts
claimCode?: string;     // normalized, unique, e.g. "TEN4821"
claimCodeActive?: boolean;
```

Plus a lookup collection so an unauthenticated-but-registered tenant can resolve the code
without reading arbitrary tenant docs:

```
tenantClaimCodes/{code} = {
  tenantId: string,
  ownerId: string,
  propertyId: string,
  active: boolean,
  createdAt: Timestamp,
}
```

### Service work

- `TenantService`:
  - On create (when owner adds a tenant), generate a unique code (reuse
    `generateInviteCode()` style + collision retry like `InviteCodeService.createCode`).
  - `regenerateClaimCode(tenantId)` and `deactivateClaimCode(tenantId)`.
  - `claimByCode(userId, code)`:
    1. Look up `tenantClaimCodes/{code}` → `{ tenantId, ... , active }`.
    2. Verify the tenant record exists and has no `userId`.
    3. Verify the claiming user has no `tenantRecordId` yet.
    4. Transaction: set `tenants/{id}.userId`, set user's `linkedOwnerId` +
       `linkedPropertyId` + `tenantRecordId`, and deactivate the claim code.
- `JoinComponent`: detect a claim code (distinct prefix/length from invite codes, e.g.
  `TEN-`) and route to `claimByCode` instead of `redeem`.

### Firestore rules (sketch)

```
match /tenantClaimCodes/{code} {
  // Any verified tenant may read an active code to claim it.
  allow get: if isVerified() && resource.data.active == true;
  // Only the owner creates/deactivates; require App Check on writes is optional.
  allow create, update, delete: if isVerified()
    && request.resource.data.ownerId == request.auth.uid;
}

match /tenants/{tenantId} {
  // Allow a verified user to set userId on an unlinked record ONLY when claiming via
  // a matching active claim code. Easiest/safest: do the claim in a Cloud Function with
  // admin privileges, or via the owner. Direct client claim needs careful diff rules:
  //   - resource.data.userId == null
  //   - request.resource.data.userId == request.auth.uid
  //   - affectedKeys hasOnly(['userId'])
  //   - a matching active tenantClaimCodes doc (get()) — note: can't easily verify the
  //     user "knows" the code from rules, so prefer a Cloud Function.
}
```

> Recommendation: implement the claim as a **Cloud Function** (callable) to avoid loosening
> client-side `tenants` write rules. The function validates the code, performs the linked
> writes atomically with admin SDK, and returns the result. This keeps the security boundary
> tight (clients never get permission to set `userId` on tenant docs directly).

### Edge cases to handle

- Code already claimed / deactivated → clear error.
- User already linked to another tenancy → block.
- Owner deletes the tenant record → deactivate the claim code.
- Code collisions → retry on generation (unique constraint via doc id in `tenantClaimCodes`).

### Why not direct client writes

Letting clients set `tenants/{id}.userId` from rules alone is risky because rules can't
confirm the caller actually possesses the shared code (only that an active code doc exists).
A callable Cloud Function is the clean way to enforce "knows the code → may claim".
