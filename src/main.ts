import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';
import { showSplashError } from './app/core/utils/splash-screen';

bootstrapApplication(AppComponent, appConfig).catch((err) => {
  console.error(err);
  showSplashError('Unable to start. Refresh the page and try again.');
});
