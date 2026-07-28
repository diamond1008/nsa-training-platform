# Phase 10 security review

Review date: 2026-07-28. Scope: API, web SPA, PostgreSQL schema, container deployment, and committed fixtures.

## Controls verified

- Authorization is enforced server-side by role middleware; Playwright also checks an admin cannot open a teacher page.
- Passwords use bcrypt, refresh tokens are opaque and stored hashed, production cookies are HttpOnly/Secure, and access secrets must be at least 32 characters.
- Production startup rejects placeholder JWT secrets and non-HTTPS/wildcard CORS origins.
- Login and refresh endpoints are rate-limited. HTTP servers have read, write, idle, header, shutdown, and handler timeouts.
- SQL is parameterized through sqlc/pgx. Request bodies have bounded JSON decoding and internal errors are not returned to clients.
- Caddy terminates TLS, adds HSTS and browser security headers. PostgreSQL is not exposed on a host port.
- Logs omit bodies, tokens, passwords, and profile details. Demo/E2E fixtures use fake `.local` identities only and are explicitly forbidden in production.
- GitHub Actions uses synthetic CI credentials and read-only repository permissions. Dependabot covers Go, npm, and actions.

## Dependency finding

The Vite/Vitest development toolchain was upgraded during this review to remove high/critical advisories. `npm audit` now reports only two moderate React Router advisories affecting versions through 7.17. The available automated fix upgrades to Router 7 and is breaking. This SPA does not use React Router server rendering/RSC deserialization, and it does not construct navigation targets from untrusted external input. CI rejects high/critical advisories. Upgrade to Router 7 should be handled as a tested dependency migration rather than forced into Phase 10.

## Remaining operational actions

- Store production secrets in the deployment platform's secret manager and rotate them on staff/host compromise.
- Place encrypted backups off-host, apply retention/access controls, and rehearse restoration.
- Add external uptime and log-based alerts appropriate to the hosting provider.
- Before accepting real learner data, document privacy retention, access review, export/deletion, and incident-notification procedures.
