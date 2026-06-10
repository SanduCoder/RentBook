# Deploy RentBook to Cloudflare Pages

1. Build the app:
   ```bash
   npm run build
   ```
2. In Cloudflare Pages, set **Build output directory** to `dist/rentbook/browser`.
3. Deploy Firestore rules separately (Firebase CLI):
   ```bash
   firebase deploy --only firestore:rules,firestore:indexes,storage
   ```
4. Add your production URL to Firebase Auth **Authorized domains**.
5. Optional: set `appCheckRecaptchaSiteKey` in `environment.ts` and enable App Check in Firebase Console.

`public/_redirects` and `public/_headers` are copied into the build output for SPA routing and security headers.
