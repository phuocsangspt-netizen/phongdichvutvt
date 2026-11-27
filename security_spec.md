# Security Specification — Automotive Dealership RBAC & Google Auth

## 1. Data Invariants
1. **Default Deny**: Every unmatched path is denied (`allow read, write: if false`).
2. **Verified Google Identity Only**: Every authenticated read/write requires `request.auth != null && request.auth.token.email_verified == true`.
3. **Manager-Approved Allowlist (Zero Self-Registration)**: Signing in with an unapproved Google account NEVER grants access to `/appointments`, `/receptionEntries`, `/settings`, `/auditLogs`, or other `/staff` documents. The user may only check their own `/staff/{myStaffId}` doc and optionally submit their own `/accessRequests/{myStaffId}` request.
4. **Instant Revocation**: Setting `isActive: false` on `/staff/{staffId}` immediately blocks every Firestore read/write by that employee at the server level.
5. **No Self-Privilege Escalation**: Regular staff cannot create, update, or delete `/staff/{staffId}` (not even their own role, permissions, or `isActive`). Only Managers (`quan_ly` or bootstrapped admin `phuocsangspt@gmail.com`) can manage `/staff`.
6. **PII Isolation**: Only Managers can `list` `/staff` or `/accessRequests` or `/auditLogs`. Non-managers can only `get` their own `/staff/{myStaffId}` and `/accessRequests/{myStaffId}`.
7. **Tiered Identity & Scope Enforcement**:
   - **Quản Lý (`quan_ly`)**: Full access across all collections including correcting terminal states (`Hoàn Thành`, `Đã Hủy`) and reading immutable `/auditLogs`.
   - **Đặt Hẹn (`dat_hen`)**: Create/edit non-terminal appointments (when `canCreateAppointments` / `canEditAppointments` granted), cannot edit `/staff` or `/settings`.
   - **Lễ Tân (`le_tan`)**: Create/update non-terminal reception entries (when `canCheckInCars` granted), read appointments for plate lookup, cannot delete appointments or modify `/staff`.
   - **Cố Vấn (`co_van`)**: Can only update `status`/`content`/`notes` on appointments or reception entries strictly assigned to their own `assignedAdvisorName` (server-enforced via `existing().advisorName == staffDoc().assignedAdvisorName`).
8. **Immutable Audit Logs**: `/auditLogs` cannot be updated or deleted by anyone (not even admins); actors can only create logs matching their own `request.auth.uid` and `request.auth.token.email`.

## 2. The "Dirty Dozen" Attack Payloads (All MUST return PERMISSION_DENIED)
1. **Unapproved Gmail read**: Random verified Gmail reads `/appointments/apt-1` -> DENIED.
2. **Unverified email admin spoof**: Token with `email: "phuocsangspt@gmail.com"`, `email_verified: false` reads `/staff` -> DENIED.
3. **Self-promotion to Admin**: Active `le_tan` updates `/staff/{self}` with `{ role: "quan_ly" }` -> DENIED.
4. **Locked employee write**: Staff with `isActive: false` attempts to create `/appointments/apt-new` -> DENIED.
5. **Cross-advisor tampering**: Active `co_van` (assigned `Nguyễn Văn Toàn`) updates appointment assigned to `Vũ Hoàng Lộc` -> DENIED.
6. **Advisor field injection**: Active `co_van` updates own appointment changing `licensePlate` or `advisorName` -> DENIED (only `status`, `content`, `updatedAt`, `updatedByEmail`, `updatedByName` allowed).
7. **Shadow/Ghost field injection**: Active `dat_hen` creates appointment with extra ghost field `isAdminApproved: true` -> DENIED (`hasOnly` check).
8. **Terminal state tampering**: Non-admin `dat_hen` attempts to edit an appointment already in `Hoàn Thành` or `Đã Hủy` -> DENIED.
9. **ID poisoning**: Active `dat_hen` writes `/appointments/bad id with spaces!` or 200-char ID -> DENIED (`isValidId`).
10. **PII scraping**: Active `le_tan` calls `list` on `/staff` or `get` on `/staff/other_employee_gmail_com` -> DENIED.
11. **Audit log falsification**: Active `co_van` creates `/auditLogs/log1` with `actorEmail: "phuocsangspt@gmail.com"` -> DENIED (`actorEmail` must equal `request.auth.token.email.lower()`).
12. **Audit log deletion**: Manager attempts `delete` or `update` on `/auditLogs/log1` -> DENIED (`allow update, delete: if false`).
