# Security Specification & Threat Model

## 1. Data Invariants
1. **User Identity & Role Invariance**: Unauthenticated users cannot read or write user profiles or school data. Only verified administrators can register or mutate user accounts with `role: 'admin'`.
2. **Path Sanitization & Injection Prevention**: Path variables `{userId}`, `{syncId}`, and `{adminId}` must be valid IDs matching `^[a-zA-Z0-9_\-]+$` and `<= 128` characters.
3. **Payload Volume Boundaries**: Synchronized diary states (`DiarySync`) must not exceed size limits (`payloadJson <= 800000` chars) to prevent Denial of Wallet.
4. **Teacher Action Limits**: Only the school Administrator can register new users, change roles, or delete user records.
5. **No Blanket Reads**: All read and write access must be validated against authenticated identity or explicit authorization.

---

## 2. The Dirty Dozen Payloads (Designed to Fail)
1. **Anonymous Read on Users**: Unauthenticated `get /users/user-1`. Result: PERMISSION_DENIED.
2. **Anonymous Write on Users**: Unauthenticated `create /users/user-hacker`. Result: PERMISSION_DENIED.
3. **Path Poisoning Injection**: Write with `{userId: "../hack/bad-path"}` or ID > 128 chars. Result: PERMISSION_DENIED.
4. **Self-Escalation to Admin**: Non-admin user updating their own profile to `role: 'admin'`. Result: PERMISSION_DENIED.
5. **Giant String Denial of Wallet**: Writing `payloadJson` exceeding 800,000 characters. Result: PERMISSION_DENIED.
6. **Shadow Field Injection**: Injecting arbitrary ghost property `isSuperRoot: true` in `User` document. Result: PERMISSION_DENIED.
7. **Missing Required Fields**: Creating a User without `name`, `email`, or `passwordHash`. Result: PERMISSION_DENIED.
8. **Invalid Role Enum**: Creating a User with `role: 'supergod'`. Result: PERMISSION_DENIED.
9. **Tampering with Admins Collection**: Non-admin writing directly to `/admins/{adminId}`. Result: PERMISSION_DENIED.
10. **Corrupted Sync Version**: Writing `version` as a string instead of a positive number. Result: PERMISSION_DENIED.
11. **Negative Version Invariant**: Updating `version` with negative integers. Result: PERMISSION_DENIED.
12. **Blanket Query Scraping**: Running unbounded list queries on sensitive user collections without authentication. Result: PERMISSION_DENIED.

---

## 3. Test Runner
A test suite covering all Dirty Dozen payloads is created in `firestore.rules.test.ts`.
