# Deploy RentBook to Cloudflare Pages

The GitHub repo root **is** the Angular app (`package.json` at the top level).  
Do **not** set root directory to `rentbook` — that folder only exists locally on some machines.

## Cloudflare Pages settings

| Setting | Value |
|---------|--------|
| Production branch | `main` |
| Root directory | *(leave blank)* |
| Build command | `npm run build` |
| Build output directory | `dist/rentbook/browser` |
| Node version | `20` (Environment variables → `NODE_VERSION` = `20`) |

After changing settings, use **Deployments → Retry deployment** on the latest commit, or push a new commit.

## If deploys don't trigger from GitHub

1. **Workers & Pages → your project → Settings → Builds** — confirm repo is `SanduCoder/RentBook` and branch is `main`.
2. **Settings → Builds → Build watch paths** — leave empty (watch whole repo) or include `src/**`, `package.json`.
3. **Deployments** tab — check if the latest build **failed** (wrong root directory is the usual cause).
4. **Reconnect GitHub** if webhooks stopped: Settings → Builds → Connect to Git → reconnect repository.

## Firebase (separate from Cloudflare)

```bash
npm run deploy:rules
```

Add your Cloudflare Pages URL to Firebase Auth **Authorized domains**.

Optional: set `appCheckRecaptchaSiteKey` in `environment.ts` and enable App Check in Firebase Console.

`public/_redirects` and `public/_headers` are copied into the build output for SPA routing and security headers.
