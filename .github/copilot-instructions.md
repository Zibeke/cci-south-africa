# CCI Connect – rules for Copilot

## Project

Internal employee portal. Backend: Node 18+, Express 4, Mongoose 8, Socket.io, CommonJS. Frontend: React 17, React Router 6, Axios. Keep this stack; do not introduce new frameworks without asking.

## Domain

- Hierarchy: Country > Location (city) > Building > Campaign (department, e.g. TalkTalk).
- Roles: `agent`, `team_leader`, `it`, `hr`, `marketing`, `admin`, `super_admin`.
- A user may only see or touch data inside the buildings/campaigns they are assigned to. Admins are limited to assigned countries. Super admins can see everything.
- `campaign` posts are written by marketing for their own building/campaign pairs.
- `country` posts are written by an admin of that country or a super admin. `showOnLandingPage` is optional and defaults to `false`.

## Non-negotiable security rules

1. All authorization happens on the server. Never trust role, building, campaign, audience, or author values sent by the client.
2. Every route that returns or changes data must call the central policy module at `backend/src/auth/policy.js`. Never add inline role checks such as `req.user.role === 'admin'` in route files.
3. Every query for posts, comments, events, gallery, users, chat, or notifications must include the scope filter from the policy module. Fetch-by-id endpoints must also apply it and return 404 (not 403) when out of scope.
4. Content is never hard-deleted. Use soft delete (`status: 'deleted'`, `deletedAt`, `deletedBy`, `deleteReason`). Normal users never see deleted content; admins in scope and super admins can.
5. Every state-changing action writes an `AuditLog` entry. `AuditLog` is append-only; never add update or delete code paths.
6. Never log passwords, tokens, cookies, or full request bodies.
7. Validate and sanitize all input on the server (type, length, ObjectId, enum). Use whitelists; never spread `req.body` into a model.
8. Uploads: derive the file extension from a validated MIME type and magic bytes, never from the original filename.
9. Do not weaken CORS, cookies, Helmet, rate limits, or CSRF protection. Do not add secrets to code; use environment variables.
10. Unauthenticated endpoints (landing page, public content) return only country posts marked `showOnLandingPage`, through a field whitelist. Do not return author names or emails, comments, building data, or campaign data. Cache and rate-limit these endpoints.
11. Geo-IP country is only a hint for choosing landing page content. It never grants access and never replaces login. Do not implement device identifiers or fingerprinting.
12. Country posts may be created only by a super admin or an admin assigned to that country. Campaign posts may be created only by marketing users within their own assignments.

## Workflow

- Work on the current feature branch only. Never run `git commit`, `git push`, `git reset`, `git clean`, `git stash`, `git checkout`, or `git switch`, or any command that changes Git history, branches, or remotes. Leave changes uncommitted for owner review on localhost.
- Use only the local development database named in `backend/.env`. Never use production URLs or credentials, and never write a real password or secret into a tracked file. Do not expose `.env` values in output.
- Make the smallest safe diff. Prefer new files, keep existing screens working, and avoid unrelated refactors.
- Work on one phase at a time. When a phase is done, run backend tests, print a review checklist (files changed, commands, URLs, what to click, expected result), and stop.
- Add tests for every permission rule (Jest + Supertest + mongodb-memory-server). Authorization changes without tests are incomplete.
- Match existing code style. Return JSON errors as `{ message }`.
- After changes, run backend tests and `npm audit`, and report anything that fails.