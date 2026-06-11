import { Component, effect, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthService } from './core/services/auth.service';
import { dismissAppSplash, startSplashWatchdog } from './core/utils/splash-screen';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  template: '<router-outlet />',
  styles: `:host { display: block; }`,
})
export class AppComponent {
  private auth = inject(AuthService);

  constructor() {
    startSplashWatchdog();

    effect(() => {
      if (!this.auth.loading()) {
        dismissAppSplash();
      }
    });
  }
}
