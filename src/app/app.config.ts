import { APP_INITIALIZER, ApplicationConfig, ErrorHandler, inject, isDevMode, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideServiceWorker } from '@angular/service-worker';
import { provideFirebaseApp, initializeApp, getApp } from '@angular/fire/app';
import { provideAuth } from '@angular/fire/auth';
import { provideFirestore } from '@angular/fire/firestore';
import { provideStorage, getStorage } from '@angular/fire/storage';
import { AppCheck, provideAppCheck, initializeAppCheck, ReCaptchaV3Provider } from '@angular/fire/app-check';
import {
  browserLocalPersistence,
  getAuth as getFirebaseAuth,
  indexedDBLocalPersistence,
  initializeAuth,
} from 'firebase/auth';
import { getFirestore as getFirebaseFirestore, initializeFirestore } from 'firebase/firestore';

import { routes } from './app.routes';
import { environment } from '../environments/environment';
import { GlobalErrorHandler } from './core/services/error-notification.service';
import { ensureAppCheckReady } from './core/utils/app-check.utils';
import { isIosStandalonePwa } from './core/utils/platform.utils';
import { preloadRecaptcha } from './core/utils/pwa-bootstrap.utils';

function createAuth() {
  const app = getApp();
  try {
    return initializeAuth(app, {
      persistence: [indexedDBLocalPersistence, browserLocalPersistence],
    });
  } catch {
    return getFirebaseAuth(app);
  }
}

function createFirestore() {
  const app = getApp();
  try {
    return initializeFirestore(app, {
      experimentalAutoDetectLongPolling: true,
    });
  } catch {
    return getFirebaseFirestore(app);
  }
}

const appCheckSiteKey = environment.appCheckRecaptchaSiteKey?.trim() ?? '';
const shouldInitAppCheck = !!appCheckSiteKey;

function createAppCheck() {
  return initializeAppCheck(getApp(), {
    provider: new ReCaptchaV3Provider(appCheckSiteKey),
    isTokenAutoRefreshEnabled: true,
  });
}

const appCheckProviders = shouldInitAppCheck
  ? [provideAppCheck(() => createAppCheck())]
  : [];

const appCheckBootstrapProviders = shouldInitAppCheck
  ? [
      {
        provide: APP_INITIALIZER,
        multi: true,
        useFactory: () => {
          const appCheck = inject(AppCheck, { optional: true });
          return async () => {
            await preloadRecaptcha(appCheckSiteKey);
            await ensureAppCheckReady(appCheck ?? null);
          };
        },
      },
    ]
  : [];

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    { provide: ErrorHandler, useClass: GlobalErrorHandler },
    provideFirebaseApp(() => initializeApp(environment.firebase)),
    ...appCheckProviders,
    ...appCheckBootstrapProviders,
    provideAuth(() => createAuth()),
    provideFirestore(() => createFirestore()),
    provideStorage(() => getStorage()),
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode() && !isIosStandalonePwa(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
};
