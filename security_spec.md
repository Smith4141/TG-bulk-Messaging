# Security Specification (Payload-First TDD)

## 1. Data Invariants
1. **Owner & Master Gate Invariant**: Every workspace subcollection under `/users/{userId}/...` requires an existing parent profile at `/users/{userId}` whose `uid` matches `userId`, and `ownerId == request.auth.uid` (unless verified admin).
2. **Email Verification & Identity Invariant**: All writes require `request.auth != null && request.auth.token.email_verified == true`. Users cannot assign themselves `'admin'` role or alter `uid` / `ownerId` / `createdAt`.
3. **PII Isolation Invariant**: User `email` is stored solely under `/users/{userId}/private/info` and is never readable by non-owners. Contacts (containing `phoneNumber` and `email`) are strictly restricted to owner or verified admin.
4. **Immutable Audit & Log Invariant**: `auditLogs` and `webhookLogs` cannot be modified after creation by non-admins.
5. **Terminal State Locking**: A `campaign` with `status == 'completed'` cannot be modified or regressed by non-admins.
6. **Temporal & Size Invariant**: All `createdAt` / `updatedAt` timestamps must match `request.time`; all IDs must match `^[a-zA-Z0-9_\-]+$` (max 128 chars); every string and array enforces explicit max size bounds.
7. **Relational Integrity**: Creating a `chatMessages` document requires the referenced `contactId` document to exist under `/users/{userId}/contacts/{contactId}`.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Unauthenticated Read/Write**: Unauthenticated request reading `/users/u1/contacts/c1` -> `PERMISSION_DENIED`.
2. **Privilege Escalation on Profile Create**: User `u1` creating `/users/u1` with `role: "admin"` -> `PERMISSION_DENIED`.
3. **Shadow Field Injection ("Ghost Field")**: User `u1` updating `/users/u1/contacts/c1` with extra field `isVerified: true` -> `PERMISSION_DENIED`.
4. **Owner Spoofing**: User `u1` creating `/users/u1/contacts/c1` with `ownerId: "u2"` -> `PERMISSION_DENIED`.
5. **Cross-Tenant Read/List**: User `u2` querying `list` on `/users/u1/contacts` -> `PERMISSION_DENIED`.
6. **Unverified Email Spoof**: User with `email: "hidden25soul@gmail.com"` and `email_verified: false` attempting admin read/write -> `PERMISSION_DENIED`.
7. **PII Leak Attempt**: User `u2` attempting `get` on `/users/u1/private/info` -> `PERMISSION_DENIED`.
8. **ID Poisoning**: Creating `/users/u1/contacts/bad$id..1500chars` -> `PERMISSION_DENIED`.
9. **Array Type/Size Poisoning**: Creating contact with `tags: [123]` or `tags.length > 20` -> `PERMISSION_DENIED`.
10. **Terminal State Regression**: Changing campaign `status` from `'completed'` back to `'running'` -> `PERMISSION_DENIED`.
11. **Timestamp Forgery**: Creating a contact with `createdAt` set to a client-chosen past date instead of server `request.time` -> `PERMISSION_DENIED`.
12. **Orphaned Chat Message**: Creating `/users/u1/chatMessages/m1` referencing a nonexistent `contactId: "missing_contact"` -> `PERMISSION_DENIED`.
