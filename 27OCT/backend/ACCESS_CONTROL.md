# Access control (RBAC)

Permissions are enforced from the RBAC tables: `roles`, `permissions`,
`role_permissions` and `user_roles`. The backend runs the idempotent RBAC
migration before it begins accepting requests. New users receive an RBAC role
at creation (stored in `user_roles`), and existing users keep their legacy
`users.role` value as a fallback until an RBAC assignment exists.

## Platform super-admin bootstrap

Set `SUPER_ADMIN_EMAILS` to a comma-separated list of existing account email
addresses to grant platform-wide super-admin access during initial setup:

```text
SUPER_ADMIN_EMAILS=platform-admin@example.com
```

Super Admin bypasses every permission check and always sees full access.

## Built-in roles

The built-in **System**, **Admin**, **Author**, **Approver/Reviewer**,
**Project Manager**, **People Manager**, **View** and **Temp View** profiles
are defined by the RBAC catalog in `backend/src/rbac/rbacCatalog.js`.
**Super Admin** remains a separate platform-wide override. Temporary view
assignments expire after one or four hours; expired assignments are denied.

Platform super admins manage roles and assignments from the **RBAC Dashboard**
in the application. The Users table shows each member's RBAC role, including
temporary-access expiry.

## Enforcement

Authenticated API requests are checked against the RBAC assignment on each
request. Expired access is denied. Frontend route and navigation checks use the
same permission keys for usability, while backend checks remain authoritative.
Role assignment from the RBAC Dashboard and Account Management is available to
users holding the `access_levels.manage` permission (super admins by default).
