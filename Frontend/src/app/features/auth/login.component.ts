import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { routeParDefaut } from '../../core/auth/role-routes';
import { ChampMotDePasseComponent } from './champ-mot-de-passe.component';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, ChampMotDePasseComponent],
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

        <div class="alert success" role="status" *ngIf="successMessage && !errorMessage">
          {{ successMessage }}
        </div>
        <div class="alert error" *ngIf="errorMessage">
          {{ errorMessage }}
        </div>

        <form (ngSubmit)="onSubmit()" class="auth-form">
          <div class="form-group">
            <label for="login-username">Nom d'utilisateur</label>
            <div class="input-wrapper">
              <input
                id="login-username"
                type="text"
                [(ngModel)]="username"
                name="username"
                placeholder="Ex: amira ou maitre_karoui"
                autocomplete="username"
                required
              />
            </div>
          </div>

          <div class="form-group">
            <div class="label-row">
              <label for="login-password">Mot de passe</label>
              <a routerLink="/connexion/mot-de-passe-oublie" class="forgot-link">Mot de passe oublié ?</a>
            </div>
            <app-champ-mot-de-passe
              inputId="login-password"
              name="password"
              [(ngModel)]="password"
              autocomplete="current-password"
              [required]="true"
            />
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
    @use 'variables' as *;

    .auth-page {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: $fond;
      padding: 24px;
    }

    .auth-card {
      background: $fond-carte;
      border: 1px solid $bordure;
      border-radius: $rayon-carte;
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
      background: $primaire;
      color: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .brand-name {
      font-size: 17px;
      font-weight: 600;
      color: $texte;
      .teal { color: $primaire; }
    }

    .auth-header {
      text-align: center;
      h2 {
        margin: 0;
        font-size: 22px;
        font-weight: 600;
        color: $texte;
      }
      p {
        margin: 4px 0 0;
        font-size: 13px;
        color: $gris;
      }
    }

    .alert {
      padding: 10px 14px;
      border-radius: $rayon-champ;
      font-size: 12.5px;
      &.error {
        background: $rouge-clair;
        color: $rouge-fonce;
      }
      &.success {
        background: $vert-clair;
        color: $vert-fonce;
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
        color: $texte;
      }
    }

    .label-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .forgot-link {
      font-size: 11.5px;
      color: $primaire-fonce;
      text-decoration: none;
      &:hover { color: $primaire-tres-fonce; text-decoration: underline; }
    }

    .input-wrapper input {
      width: 100%;
      min-height: 44px;
      padding: 0 14px;
      border: 1px solid $bordure-champ;
      border-radius: $rayon-champ;
      font-size: 13.5px;
      color: $texte;
      outline: none;
      transition: border-color 0.15s ease;

      &:focus {
        border-color: $primaire;
      }
    }

    .btn-submit {
      margin-top: 6px;
      min-height: 44px;
      border: 0;
      background: $primaire;
      color: #ffffff;
      font-weight: 600;
      font-size: 13px;
      border-radius: $rayon-champ;
      transition: background 0.15s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;

      &:hover:not(:disabled) {
        background: $primaire-fonce;
      }
      &:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
    }

    .keycloak-badge {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      font-size: 11px;
      color: $gris;
      background: $fond-doux;
      padding: 8px;
      border-radius: $rayon-champ;
    }

    .auth-footer {
      text-align: center;
      font-size: 13px;
      color: $gris;

      .link-bold {
        color: $primaire-fonce;
        font-weight: 600;
        text-decoration: none;
        &:hover { color: $primaire-tres-fonce; text-decoration: underline; }
      }
    }
  `]
})
export class LoginComponent {
  username = '';
  password = '';
  loading = false;
  errorMessage = '';
  successMessage = '';

  constructor(private authService: AuthService, private router: Router, route: ActivatedRoute) {
    // Retour de « Mot de passe oublié » après un changement réussi
    if (route.snapshot.queryParamMap.has('motDePasseModifie')) {
      this.successMessage = 'Votre mot de passe a été modifié. Connectez-vous avec le nouveau mot de passe.';
    }
  }

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
