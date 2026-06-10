import { Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { canManageTenants } from '../../../core/utils/role.utils';
import { Icon3dComponent } from '../icon-3d/icon-3d.component';

@Component({
  selector: 'app-bottom-nav',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, Icon3dComponent],
  templateUrl: './bottom-nav.component.html',
  styleUrl: './bottom-nav.component.scss',
})
export class BottomNavComponent {
  private auth = inject(AuthService);

  canManage = computed(() => canManageTenants(this.auth.currentUser()?.role));
}
