import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet } from '@angular/router';
import { SidebarComponent } from './shared/components/sidebar/sidebar.component';
import { TopbarComponent } from './shared/components/topbar/topbar.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, SidebarComponent, TopbarComponent],
  template: `
    <!-- When on /login or /register, render full-screen auth layout -->
    <ng-container *ngIf="isAuthPage(); else dashboardLayout">
      <router-outlet></router-outlet>
    </ng-container>

    <!-- Otherwise render standard dashboard layout -->
    <ng-template #dashboardLayout>
      <div class="app-layout">
        <!-- Fixed Left Sidebar -->
        <app-sidebar></app-sidebar>

        <!-- Main Layout Body -->
        <div class="main-wrapper">
          <!-- Sticky Topbar -->
          <app-topbar></app-topbar>

          <!-- Routed Views -->
          <main class="main-content">
            <router-outlet></router-outlet>
          </main>
        </div>
      </div>
    </ng-template>
  `,
  styles: [`
    .app-layout {
      display: flex;
      min-height: 100vh;
      background-color: var(--bg-app);
    }

    .main-wrapper {
      margin-left: 260px;
      flex: 1;
      display: flex;
      flex-direction: column;
      min-width: 0;
    }

    .main-content {
      flex: 1;
    }
  `]
})
export class App {
  private router = inject(Router);

  isAuthPage(): boolean {
    const url = this.router.url;
    return url.includes('/login') || url.includes('/register');
  }
}
