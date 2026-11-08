import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { routeParDefaut } from '../../core/auth/role-routes';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="auth-page">
      <div class="auth-card">
        <!-- Logo -->
        <div class="auth-brand">
          <div class="brand-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
            </svg>
          </div>
          <span class="brand-name">LaunchPad <span class="teal">AI</span></span>
        </div>

        <div class="auth-header">
          <h2>Se connecter</h2>
          <p>Accédez à votre espace LaunchPad AI.</p>
        </div>

        <div class="alert error" *ngIf="errorMessage">
          {{ errorMessage }}
        </div>

        <form (ngSubmit)="onSubmit()" class="auth-form">
          <div class="form-group">
            <label>Nom d'utilisateur</label>
            <div class="input-wrapper">
              <input 
                type="text" 
                [(ngModel)]="username" 
                name="username" 
                placeholder="Ex: amira ou maitre_karoui" 
                required 
              />
            </div>
          </div>

          <div class="form-group">
            <div class="label-row">
              <label>Mot de passe</label>
              <a href="#" class="forgot-link">Mot de passe oublié ?</a>
            </div>
            <div class="input-wrapper">
              <input 
                type="password" 
                [(ngModel)]="password" 
                name="password" 
                placeholder="••••••••" 
                required 
              />
            </div>
          </div>

          <button type="submit" class="btn-submit" [disabled]="loading">
            <span *ngIf="!loading">Se connecter</span>
            <span *ngIf="loading">Connexion en cours...</span>
          </button>
        </form>

        <div class="keycloak-badge">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
          Authentification sécurisée Keycloak / IAM
        </div>

        <div class="auth-footer">
          Pas encore de compte ?
          <a routerLink="/connexion/register" class="link-bold">Créer un compte</a>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .auth-page {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #f0fdfa 0%, #f4f7f6 100%);
      padding: 24px;
    }

    .auth-card {
      background: #ffffff;
      border: 1px solid var(--border-color);
      border-radius: var(--radius-lg);
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05);
      width: 100%;
      max-width: 440px;
      padding: 36px 32px;
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .auth-brand {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
    }

    .brand-icon {
      width: 36px;
      height: 36px;
      border-radius: 10px;
      background: linear-gradient(135deg, #0d9488 0%, #0284c7 100%);
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .brand-name {
      font-size: 19px;
      font-weight: 800;
      color: var(--text-main);
      .teal { color: var(--primary-teal); }
    }

    .auth-header {
      text-align: center;
      h2 {
        font-size: 22px;
        font-weight: 700;
        color: var(--text-main);
      }
      p {
        font-size: 13px;
        color: var(--text-muted);
        margin-top: 4px;
      }
    }

    .alert {
      padding: 10px 14px;
      border-radius: var(--radius-sm);
      font-size: 12.5px;
      &.error {
        background: #fef2f2;
        color: #dc2626;
        border: 1px solid #fee2e2;
      }
    }

    .auth-form {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 6px;

      label {
        font-size: 12px;
        font-weight: 600;
        color: var(--text-main);
      }
    }

    .label-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .forgot-link {
      font-size: 11.5px;
      color: var(--primary-teal);
      text-decoration: none;
      &:hover { text-decoration: underline; }
    }

    .input-wrapper input {
      width: 100%;
      padding: 11px 14px;
      border: 1px solid var(--border-color);
      border-radius: var(--radius-sm);
      font-size: 13.5px;
      outline: none;
      transition: all 0.15s ease;

      &:focus {
        border-color: var(--primary-teal);
        box-shadow: 0 0 0 3px rgba(13, 148, 136, 0.1);
      }
    }

    .btn-submit {
      margin-top: 6px;
      background: var(--primary-teal);
      color: white;
      font-weight: 600;
      font-size: 14px;
      padding: 12px;
      border-radius: var(--radius-sm);
      transition: background 0.15s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;

      &:hover:not(:disabled) {
        background: var(--primary-teal-hover);
      }
      &:disabled {
        opacity: 0.7;
        cursor: not-allowed;
      }
    }

    .keycloak-badge {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      font-size: 11px;
      color: var(--text-light);
      background: #f8fafc;
      padding: 8px;
      border-radius: var(--radius-sm);
    }

    .auth-footer {
      text-align: center;
      font-size: 13px;
      color: var(--text-muted);

      .link-bold {
        color: var(--primary-teal);
        font-weight: 600;
        text-decoration: none;
        &:hover { text-decoration: underline; }
      }
    }
  `]
})
export class LoginComponent {
  username = '';
  password = '';
  loading = false;
  errorMessage = '';

  constructor(private authService: AuthService, private router: Router) {}

  onSubmit(): void {
    if (!this.username || !this.password) {
      this.errorMessage = 'Veuillez saisir votre nom d’utilisateur et votre mot de passe.';
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    this.authService.login({ username: this.username, password: this.password }).subscribe({
      next: (res) => {
        this.loading = false;
        // Direction selon le rôle de l'utilisateur connecté (voir core/auth/role-routes.ts).
        const role = res?.user?.role ?? this.authService.currentUserValue?.role;
        this.router.navigateByUrl(routeParDefaut(role));
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage = err?.error?.error || 'Échec de connexion. Veuillez vérifier vos identifiants.';
      }
    });
  }
}
