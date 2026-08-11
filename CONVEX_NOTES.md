# Convex Backend — Student Mobile App

## This repo owns the backend

`student-semester-reminder` is the **single source of truth** for all Convex
functions and schema. The admin web app (`termio-admin`) is a pure client.

```
student-semester-reminder/
  convex/              ← ALL mutations, queries, schema, auth
  .env.local           ← CONVEX_URL = https://colorless-shepherd-537.convex.cloud

termio-admin/
  convex.json          ← { "functions": "../../student-semester-reminder/convex/" }
  .env.local           ← same CONVEX_URL
```

## Starting Convex dev

```bash
# From this repo (mobile app)
bun convex dev

# From the admin web app — also works via convex.json
cd ../termio-admin && bun convex dev
```

Both commands sync to the **same deployment** (`colorless-shepherd-537`).

## Key files

| File | Purpose |
|---|---|
| `convex/schema.ts` | Full DB schema — all tables and indexes |
| `convex/auth.ts` | Password + OTP auth, student signup gating |
| `convex/academicStructure.ts` | Faculty/Dept/Program/Class/Division CRUD |
| `convex/adminDashboard.ts` | Admin overview aggregates |
| `convex/semesters.ts` | Active semester query |
| `convex/admins.ts` | Internal admin account creation (CLI only) |
| `convex/adminAuth.ts` | `requireAdmin` guard used by all admin mutations |

## Adding admin features

1. Add the mutation/query to the correct `convex/*.ts` file.
2. Gate writes with `await requireAdmin(ctx)` from `convex/adminAuth.ts`.
3. The admin web app calls it via `anyApi.<file>.<function>` — no codegen needed.

## Environment variables

| Variable | Value |
|---|---|
| `CONVEX_URL` | `https://colorless-shepherd-537.convex.cloud` |
| `AUTH_RESEND_KEY` | Resend API key for email OTP verification |
| `EXPO_PUBLIC_CONVEX_URL` | Same URL, exposed to Expo client |
