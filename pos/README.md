# Tablewise — Restaurant POS

This is the **Tables & Billing** restaurant POS application currently deployed as the Railway service `tablewise-demo`. It lives in `pos/` to keep the existing Pritam Fast Food public website at the repository root unchanged.

## Stack

- Bun + TypeScript (HTTP server / session authentication)
- Plain HTML, CSS and browser JavaScript (billing UI)
- PostgreSQL (versioned cloud snapshot of restaurant, menu, orders, bills and related data)
- Railway for hosting

## Layout

```text
pos/
  src/server.ts          Bun API, authentication and HTML composition
  src/client/index.html  POS base UI, styles and client behavior
  package.json           Start command
  .env.example           Names of required settings; no real credentials
  .gitignore
  railway.json
```

## Local development

1. Install Bun (modern version supporting `bun:sql`) and PostgreSQL.
2. From `pos/`, copy `.env.example` to `.env`.
3. Configure your own PostgreSQL `DATABASE_URL`, login account and generated scrypt password hash, and secure session secret.
4. The original Railway Function also injects **several JavaScript/CSS extension modules from Railway service variables**. The variable names are in `.env.example`. These extension **values are not available through the connected Railway integration** and **have not been committed**. Without those extension values, local startup will fail. To make this repo fully self-contained, export the *non-secret* extension source files separately and replace the environment injections with file imports.
5. Run `bun run start` (or `bun run dev`) and open the local port.

## Production deployment

The original Railway service uses a `Postgres` service and has the `DATABASE_URL`, authentication, and JavaScript/CSS extension variables already configured. **Do not overwrite/delete those variables or the Postgres service** during source migration. Set the Railway service Root Directory to `/pos` and Start Command to `bun run start` when connecting the existing service to GitHub `main`.

**Security:** Credentials, hashed passwords, auth tokens, production DB records and environment-variable values are intentionally excluded from GitHub. This repository is public; do not commit `.env` files.

## Legacy website

The root-level `index.html`, `menu.html`, `script.js`, `menu.js` and `style.css` remain the separate public-facing restaurant website. They were not replaced or moved.
