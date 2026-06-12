import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';
import { showSplashError } from './app/core/utils/splash-screen';
import { prepareIosStandalonePwa } from './app/core/utils/pwa-bootstrap.utils';
import { environment } from './environments/environment';

const debugToken = (environment as { appCheckDebugToken?: string | boolean }).appCheckDebugToken;
if (debugToken && !environment.production) {
  (globalThis as typeof globalThis & { FIREBASE_APPCHECK_DEBUG_TOKEN?: string | boolean })
    .FIREBASE_APPCHECK_DEBUG_TOKEN = debugToken === true ? true : debugToken;
}

prepareIosStandalonePwa()
  .then(() => bootstrapApplication(AppComponent, appConfig))
  .catch((err) => {
    console.error(err);
    showSplashError('Unable to start. Refresh the page and try again.');
  });
