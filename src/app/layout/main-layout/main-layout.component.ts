import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AppToastComponent } from '../../shared/components/app-toast/app-toast.component';
import { BottomNavComponent } from '../../shared/components/bottom-nav/bottom-nav.component';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [RouterOutlet, BottomNavComponent, AppToastComponent],
  template: `
    <div class="app-shell">
      <main class="main-content">
        <router-outlet />
      </main>
      <app-bottom-nav />
      <app-toast />
    </div>
  `,
  styles: `
    .app-shell {
      min-height: 100dvh;
      background: var(--background);
      max-width: 480px;
      margin: 0 auto;
      position: relative;
    }
    .main-content {
      padding: 1rem 1rem 5.5rem;
    }
  `,
})
export class MainLayoutComponent {}
