import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <header class="topbar">
      <!-- Search Input -->
      <div class="search-box">
        <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
        </svg>
        <input type="text" placeholder="Rechercher un dossier, un client, un document..." class="search-input" />
        <span class="search-shortcut">⌘ K</span>
      </div>

      <!-- Right Actions: Notifications & User profile -->
      <div class="topbar-right">
        <!-- Notification Bell -->
        <button class="icon-button" title="Notifications">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>
          </svg>
          <span class="notif-dot"></span>
        </button>

        <!-- User Profile Pill -->
        <div class="user-profile" (click)="toggleDropdown()">
          <div class="user-avatar">{{ getInitials() }}</div>
          <div class="user-info">
            <div class="user-name">{{ currentUser?.first_name || 'Maître' }} {{ currentUser?.last_name || currentUser?.username || 'Karoui' }}</div>
            <div class="user-role">{{ currentUser?.role || 'Avocat' }} • Keycloak</div>
          </div>
        </div>

        <button class="btn-logout" (click)="onLogout()" title="Déconnexion Keycloak">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/>
          </svg>
        </button>
      </div>
    </header>
  `,
  styles: [`
    .topbar {
      height: 70px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 32px;
      background: #ffffff;
      border-bottom: 1px solid var(--border-color);
      position: sticky;
      top: 0;
      z-index: 40;
    }

    .search-box {
      display: flex;
      align-items: center;
      gap: 10px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: var(--radius-full);
      padding: 8px 16px;
      width: 380px;
      transition: all 0.2s ease;

      &:focus-within {
        background: #ffffff;
        border-color: var(--primary-teal);
        box-shadow: 0 0 0 3px rgba(13, 148, 136, 0.1);
      }
    }

    .search-icon {
      color: var(--text-light);
    }

    .search-input {
      border: none;
      background: transparent;
      outline: none;
      width: 100%;
      font-size: 13px;
      color: var(--text-main);

      &::placeholder {
        color: var(--text-light);
      }
    }

    .search-shortcut {
      font-size: 11px;
      font-weight: 600;
      color: var(--text-light);
      background: #e2e8f0;
      padding: 2px 6px;
      border-radius: 4px;
    }

    .topbar-right {
      display: flex;
      align-items: center;
      gap: 14px;
    }

    .icon-button, .btn-logout {
      position: relative;
      width: 38px;
      height: 38px;
      border-radius: var(--radius-full);
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--text-muted);
      border: 1px solid var(--border-color);
      transition: all 0.15s ease;

      &:hover {
        background: #f8fafc;
        color: var(--text-main);
      }
    }

    .btn-logout:hover {
      background: #fef2f2;
      color: #dc2626;
      border-color: #fee2e2;
    }

    .notif-dot {
      position: absolute;
      top: 8px;
      right: 8px;
      width: 7px;
      height: 7px;
      background: #ef4444;
      border-radius: 50%;
      border: 1.5px solid white;
    }

    .user-profile {
      display: flex;
      align-items: center;
      gap: 12px;
      cursor: pointer;
      padding: 4px 8px;
      border-radius: var(--radius-md);
      transition: background 0.15s ease;

      &:hover {
        background: #f8fafc;
      }
    }

    .user-avatar {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: #e0f2fe;
      color: #0369a1;
      font-size: 12px;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .user-info {
      display: flex;
      flex-direction: column;
    }

    .user-name {
      font-size: 13px;
      font-weight: 600;
      color: var(--text-main);
      line-height: 1.2;
    }

    .user-role {
      font-size: 11px;
      color: var(--text-muted);
    }
  `]
})
export class TopbarComponent {
  private authService = inject(AuthService);
  private router = inject(Router);

  currentUser = this.authService.currentUserValue;

  constructor() {
    this.authService.currentUser$.subscribe(u => {
      this.currentUser = u;
    });
  }

  getInitials(): string {
    if (this.currentUser?.first_name && this.currentUser?.last_name) {
      return (this.currentUser.first_name[0] + this.currentUser.last_name[0]).toUpperCase();
    }
    return (this.currentUser?.username?.slice(0, 2) || 'MK').toUpperCase();
  }

  toggleDropdown(): void {}

  onLogout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}


