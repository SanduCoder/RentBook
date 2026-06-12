export const environment = {
  production: false,
  firebase: {
    apiKey: 'AIzaSyDROC6j7cbXHVSRDHAs80BnVOb9dYhxBXk',
    authDomain: 'rentbook-79357.firebaseapp.com',
    projectId: 'rentbook-79357',
    storageBucket: 'rentbook-79357.firebasestorage.app',
    messagingSenderId: '642616978956',
    appId: '1:642616978956:web:c4bbf9d4904e8996924829',
    measurementId: 'G-VDE3009TTM',
  },
  /** reCAPTCHA v3 site key (Firebase Console → App Check). Used in production; in dev only with `appCheckDebugToken`. */
  appCheckRecaptchaSiteKey: '6LfYMxgtAAAAAEn-YA-jMisZrrTZig2DsJAyIIH-',
  /**
   * Set to `true` or a registered debug token to test App Check locally.
   * Register tokens in Firebase Console → App Check → Manage debug tokens.
   */
  appCheckDebugToken: '' as string | boolean,
};
