import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <aside class="sidebar">
      <!-- Logo -->
      <div class="brand">
        <div class="logo-icon">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
          </svg>
        </div>
        <span class="brand-text">LaunchPad <span class="brand-ai">AI</span></span>
      </div>

      <!-- Section Title changes according to user role -->
      <div class="nav-section-title">
        {{ isLawyer() ? 'ESPACE AVOCAT' : 'ESPACE STARTUP' }}
      </div>

      <!-- Navigation Links -->
      <nav class="nav-list">
        <!-- Tableau de bord -->
        <a class="nav-item" routerLink="/dashboard" routerLinkActive="active-pill" [routerLinkActiveOptions]="{exact: true}">
          <svg class="nav-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/>
            <rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/>
          </svg>
          <span>Tableau de bord</span>
        </a>

        <!-- IF LAWYER: Dedicated Lawyer Space -->
        <ng-container *ngIf="isLawyer()">
          <a class="nav-item" routerLink="/lawyer" routerLinkActive="active-pill">
            <svg class="nav-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="m14 14 1:1m-6-6 1:1"/><path d="m16 8 3-3a1.414 1.414 0 0 1 2 2l-3 3"/>
              <path d="m7 17-3 3a1.414 1.414 0 0 1-2-2l3-3"/><path d="m13 15 5-5-3-3-5 5Z"/><path d="m2 22 4-4"/>
            </svg>
            <span>Clients & Dossiers</span>
            <span class="active-badge">Pro</span>
          </a>

          <a class="nav-item" routerLink="/lawyer" [queryParams]="{tab: 'messages'}" routerLinkActive="active-pill">
            <svg class="nav-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            <span>Messagerie</span>
          </a>

          <a class="nav-item" routerLink="/lawyer" [queryParams]="{tab: 'docreviews'}" routerLinkActive="active-pill">
            <svg class="nav-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" x2="8" y1="13" y2="13"/><line x1="16" x2="8" y1="17" y2="17"/>
            </svg>
            <span>Revue documentaire</span>
          </a>
        </ng-container>

        <!-- IF FOUNDER (STARTUP) -->
        <ng-container *ngIf="!isLawyer()">
          <a class="nav-item" routerLink="/lawyer" routerLinkActive="active-pill">
            <svg class="nav-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="m14 14 1:1m-6-6 1:1"/><path d="m16 8 3-3a1.414 1.414 0 0 1 2 2l-3 3"/>
              <path d="m7 17-3 3a1.414 1.414 0 0 1-2-2l3-3"/><path d="m13 15 5-5-3-3-5 5Z"/><path d="m2 22 4-4"/>
            </svg>
            <span>Avocats & Experts</span>
          </a>

          <a class="nav-item disabled">
            <svg class="nav-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/>
              <path d="M14 8H8"/><path d="M16 12H8"/><path d="M13 16H8"/>
            </svg>
            <span>Comptabilité</span>
          </a>

          <a class="nav-item disabled">
            <svg class="nav-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/>
            </svg>
            <span>Finance</span>
          </a>

          <a class="nav-item disabled">
            <svg class="nav-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" x2="18" y1="20" y2="10"/><line x1="12" x2="12" y1="20" y2="4"/><line x1="6" x2="6" y1="20" y2="14"/>
            </svg>
            <span>Marché</span>
          </a>
        </ng-container>
      </nav>

      <!-- Bottom Card & Role Indicator -->
      <div class="sidebar-bottom">
        <div class="role-switcher-banner">
          <div class="role-text">
            <span>Connecté en tant que:</span>
            <strong>{{ isLawyer() ? 'Avocat / Expert' : 'Fondateur Startup' }}</strong>
          </div>
          <button class="switch-btn" (click)="toggleDemoRole()" title="Basculer de rôle (Démo)">
            ⇄ Basculer
          </button>
        </div>

        <div class="help-link">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/><path d="9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <span>Centre d'aide</span>
        </div>
      </div>
    </aside>
  `,
  styles: [`
    .sidebar {
      width: 260px;
      height: 100vh;
      position: fixed;
      top: 0;
      left: 0;
      background: #ffffff;
      border-right: 1px solid var(--border-color);
      display: flex;
      flex-direction: column;
      padding: 20px 16px;
      z-index: 50;
      user-select: none;
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 4px 8px 24px 8px;
    }

    .logo-icon {
      width: 36px;
      height: 36px;
      border-radius: 10px;
      background: linear-gradient(135deg, #0d9488 0%, #0284c7 100%);
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 10px rgba(13, 148, 136, 0.25);
    }

    .brand-text {
      font-size: 17px;
      font-weight: 700;
      color: var(--text-main);
      letter-spacing: -0.3px;
    }

    .brand-ai {
      color: var(--primary-teal);
    }

    .nav-section-title {
      font-size: 11px;
      font-weight: 700;
      color: var(--text-light);
      text-transform: uppercase;
      letter-spacing: 0.8px;
      padding: 0 10px 10px 10px;
    }

    .nav-list {
      display: flex;
      flex-direction: column;
      gap: 4px;
      flex: 1;
      overflow-y: auto;
    }

    .nav-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 12px;
      border-radius: var(--radius-md);
      color: var(--text-muted);
      text-decoration: none;
      font-size: 13.5px;
      font-weight: 500;
      transition: all 0.15s ease;

      &:hover:not(.disabled) {
        background: #f8fafc;
        color: var(--text-main);
      }

      &.disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      &.active-pill {
        background: var(--primary-teal-light);
        color: var(--primary-teal-dark);
        font-weight: 600;

        .nav-icon {
          color: var(--primary-teal);
        }
      }
    }

    .active-badge {
      margin-left: auto;
      font-size: 10.5px;
      font-weight: 700;
      background: var(--primary-teal);
      color: white;
      padding: 2px 7px;
      border-radius: 20px;
    }

    .sidebar-bottom {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding-top: 14px;
      border-top: 1px solid var(--border-light);
    }

    .role-switcher-banner {
      background: #f8fafc;
      border: 1px solid var(--border-color);
      border-radius: var(--radius-sm);
      padding: 10px 12px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }

    .role-text {
      display: flex;
      flex-direction: column;
      font-size: 10.5px;
      color: var(--text-light);

      strong {
        font-size: 12px;
        color: var(--text-main);
      }
    }

    .switch-btn {
      font-size: 11px;
      font-weight: 600;
      color: var(--primary-teal);
      background: var(--primary-teal-light);
      padding: 4px 8px;
      border-radius: 4px;
      &:hover { background: #ccfbf1; }
    }

    .help-link {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 6px 10px;
      color: var(--text-muted);
      font-size: 12.5px;
      cursor: pointer;
      &:hover { color: var(--text-main); }
    }
  `]
})
export class SidebarComponent {
  private authService = inject(AuthService);

  isLawyer(): boolean {
    const user = this.authService.currentUserValue;
    return user?.role === 'lawyer';
  }

  toggleDemoRole(): void {
    const user = this.authService.currentUserValue;
    const newRole = user?.role === 'lawyer' ? 'user' : 'lawyer';
    const updatedUser = {
      ...(user || { username: 'demo_user', email: 'demo@launchpad.ai' }),
      role: newRole,
      first_name: newRole === 'lawyer' ? 'Maître' : 'Amira',
      last_name: newRole === 'lawyer' ? 'Karoui' : 'Ben Ali'
    };
    localStorage.setItem('current_user', JSON.stringify(updatedUser));
    (this.authService as any).currentUserSubject.next(updatedUser);
  }
}
