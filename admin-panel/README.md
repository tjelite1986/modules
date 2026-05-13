# admin-panel

Admin UI and API for generating, listing, and revoking invite codes used at registration.

## What's included

- `api/admin/codes/route.ts` — GET (list all with usage), POST (generate new), DELETE (remove unused)
- `pages/admin/page.tsx` — ready-made UI for admins

## Dependencies

- **authentication** (required for `verifyAdmin` + `users.is_admin` + `invite_codes` table)

## Setup

1. Copy files according to `module.json`
2. Promote a user to admin in the DB:
   ```sql
   UPDATE users SET is_admin = 1 WHERE username = 'thomas';
   ```
3. Sign in as that user and visit `/admin`

## Customization

- **Code format**: 8 chars (`A-Z` excl. I,O + `2-9`) — change `generateCode()` in route.ts
- **Page path**: rename the folder from `admin/` to `users/` etc.
