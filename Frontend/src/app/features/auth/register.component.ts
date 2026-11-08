import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService, RegisterPayload, Role } from '../../core/services/auth.service';

const LABEL_ROLE: Record<Role, string> = {
  ENTREPRENEUR: 'Fondateur de Startup',
  LAWYER: 'Avocat / Expert Juridique',
  ACCOUNTANT: 'Comptable',
  FINANCIER: 'Financier',
  ADMIN: 'Administrateur',
};

@Component({
  selector: 'app-register',
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
          <h2>Créer un compte</h2>
          <p>Rejoignez LaunchPad AI en tant que Fondateur de Startup ou Avocat.</p>
        </div>

        <div class="alert error" *ngIf="errorMessage">
          {{ errorMessage }}
        </div>
        <div class="alert success" *ngIf="successMessage">
          {{ successMessage }}
        </div>

        <form (ngSubmit)="onSubmit()" class="auth-form">
          <!-- Role Selector Tabs -->
          <div class="role-selector-group">
            <label class="group-label">Je m'inscris en tant que :</label>
            <div class="role-pills">
              <button
                type="button"
                class="role-pill"
                [class.selected]="formData.role === 'ENTREPRENEUR'"
                (click)="formData.role = 'ENTREPRENEUR'">
                🚀 Fondateur de Startup
              </button>
              <button
                type="button"
                class="role-pill"
                [class.selected]="formData.role === 'LAWYER'"
                (click)="formData.role = 'LAWYER'">
                ⚖️ Avocat / Expert Juridique
              </button>
              <button
                type="button"
                class="role-pill"
                [class.selected]="formData.role === 'ACCOUNTANT'"
                (click)="formData.role = 'ACCOUNTANT'">
                📊 Comptable
              </button>
              <button
                type="button"
                class="role-pill"
                [class.selected]="formData.role === 'FINANCIER'"
                (click)="formData.role = 'FINANCIER'">
                💰 Financier
              </button>
            </div>
          </div>

          <div class="form-row-2">
            <div class="form-group">
              <label>Prénom</label>
              <input type="text" [(ngModel)]="formData.first_name" name="first_name" placeholder="Ex: Amira" />
            </div>
            <div class="form-group">
              <label>Nom</label>
              <input type="text" [(ngModel)]="formData.last_name" name="last_name" placeholder="Ex: Ben Ali" />
            </div>
          </div>

          <div class="form-group">
            <label>Nom d'utilisateur (Identifiant)</label>
            <input type="text" [(ngModel)]="formData.username" name="username" placeholder="Ex: amira_nextpay" required />
          </div>

          <div class="form-group">
            <label>Adresse email professionnelle</label>
            <input type="email" [(ngModel)]="formData.email" name="email" placeholder="Ex: amira@nextpay.tn" required />
          </div>

          <div class="form-group">
            <label>Téléphone</label>
            <input type="text" [(ngModel)]="formData.phone_number" name="phone_number" placeholder="+216 20 000 000" />
          </div>

          <div class="form-group">
            <label>Mot de passe</label>
            <input type="password" [(ngModel)]="formData.password" name="password" placeholder="Min. 8 caractères" required />
          </div>

          <button type="submit" class="btn-submit" [disabled]="loading">
            <span *ngIf="!loading">Créer mon compte ({{ libelleRole(formData.role) }})</span>
            <span *ngIf="loading">Création du compte en cours...</span>
          </button>
        </form>

        <div class="auth-footer">
          Vous avez déjà un compte ?
          <a routerLink="/connexion/login" class="link-bold">Se connecter</a>
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
      padding: 32px 20px;
    }

    .auth-card {
      background: #ffffff;
      border: 1px solid var(--border-color);
      border-radius: var(--radius-lg);
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05);
      width: 100%;
      max-width: 500px;
      padding: 36px 32px;
      display: flex;
      flex-direction: column;
      gap: 18px;
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
        font-size: 12.5px;
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
      &.success {
        background: #ecfdf5;
        color: #059669;
        border: 1px solid #d1fae5;
      }
    }

    .auth-form {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .role-selector-group {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .group-label {
      font-size: 12px;
      font-weight: 700;
      color: var(--text-main);
    }

    .role-pills {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }

    .role-pill {
      padding: 10px 12px;
      border-radius: var(--radius-sm);
      border: 1.5px solid var(--border-color);
      background: #f8fafc;
      font-size: 12.5px;
      font-weight: 600;
      color: var(--text-muted);
      cursor: pointer;
      text-align: center;
      transition: all 0.15s ease;

      &:hover {
        border-color: #cbd5e1;
        color: var(--text-main);
      }

      &.selected {
        border-color: var(--primary-teal);
        background: var(--primary-teal-light);
        color: var(--primary-teal-dark);
        font-weight: 700;
      }
    }

    .form-row-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 5px;

      label {
        font-size: 12px;
        font-weight: 600;
        color: var(--text-main);
      }

      input {
        width: 100%;
        padding: 9px 12px;
        border: 1px solid var(--border-color);
        border-radius: var(--radius-sm);
        font-size: 13px;
        outline: none;
        transition: all 0.15s ease;

        &:focus {
          border-color: var(--primary-teal);
          box-shadow: 0 0 0 3px rgba(13, 148, 136, 0.1);
        }
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
      cursor: pointer;

      &:hover:not(:disabled) {
        background: var(--primary-teal-hover);
      }
      &:disabled {
        opacity: 0.7;
        cursor: not-allowed;
      }
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
export class RegisterComponent {
  formData: RegisterPayload = {
    username: '',
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    phone_number: '',
    role: 'ENTREPRENEUR', // Défaut : Fondateur de Startup
  };

  loading = false;
  errorMessage = '';
  successMessage = '';

  constructor(private authService: AuthService, private router: Router) {}

  protected libelleRole(role?: Role): string {
    return role ? LABEL_ROLE[role] : LABEL_ROLE.ENTREPRENEUR;
  }

  onSubmit(): void {
    if (!this.formData.username || !this.formData.email || !this.formData.password) {
      this.errorMessage = 'Veuillez remplir tous les champs obligatoires.';
      return;
    }

    this.loading = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.authService.register(this.formData).subscribe({
      next: () => {
        this.loading = false;
        this.successMessage = `Compte ${this.libelleRole(this.formData.role)} créé avec succès ! Redirection vers la connexion...`;
        setTimeout(() => {
          this.router.navigate(['/connexion/login']);
        }, 1200);
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage = err?.error?.error || 'Échec de la création du compte.';
      }
    });
  }
}
