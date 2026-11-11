import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ChampMotDePasseComponent } from './champ-mot-de-passe.component';
import { ErreurReinitialisation, MotDePasseOublieService } from './mot-de-passe-oublie.service';

/** Message unique : ne jamais révéler si un compte existe pour cet identifiant. */
const MESSAGE_ENVOYE = 'Si un compte existe, un code a été envoyé.';
/** Délai avant de pouvoir redemander un code (secondes). */
const DELAI_RENVOI = 60;

/** Règles du mot de passe (identiques au User-Service). */
const CRITERES: { libelle: string; test: (mdp: string) => boolean }[] = [
  { libelle: 'Au moins 8 caractères', test: (m) => m.length >= 8 },
  { libelle: 'Une majuscule', test: (m) => /[A-Z]/.test(m) },
  { libelle: 'Un chiffre', test: (m) => /\d/.test(m) },
  { libelle: 'Un caractère spécial', test: (m) => /[^A-Za-z0-9]/.test(m) },
];

/**
 * « Mot de passe oublié » (/connexion/mot-de-passe-oublie), en 2 étapes :
 * 1. e-mail ou nom d'utilisateur -> code à 6 chiffres envoyé par e-mail (valable 10 minutes) ;
 * 2. code + nouveau mot de passe + confirmation -> retour à la connexion avec un message.
 */
@Component({
  selector: 'app-mot-de-passe-oublie',
  standalone: true,
  imports: [FormsModule, RouterLink, ChampMotDePasseComponent],
  template: `
    <div class="auth-page">
      <div class="auth-card">
        <div class="auth-brand">
          <div class="brand-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
            </svg>
          </div>
          <span class="brand-name">LaunchPad <span class="teal">AI</span></span>
        </div>

        <div class="auth-header">
          <h2>Mot de passe oublié</h2>
          @if (etape() === 1) {
            <p>Saisissez votre e-mail ou votre nom d'utilisateur : nous vous enverrons un code à 6 chiffres.</p>
          } @else {
            <p>Saisissez le code reçu par e-mail et choisissez un nouveau mot de passe.</p>
          }
        </div>

        <ol class="etapes" aria-label="Étapes">
          <li [class.active]="etape() === 1" [attr.aria-current]="etape() === 1 ? 'step' : null">1. Recevoir un code</li>
          <li [class.active]="etape() === 2" [attr.aria-current]="etape() === 2 ? 'step' : null">2. Nouveau mot de passe</li>
        </ol>

        @if (info()) {
          <div class="alert success" role="status">{{ info() }}</div>
        }
        @if (erreur()) {
          <div class="alert error" role="alert">{{ erreur() }}</div>
        }

        @if (etape() === 1) {
          <form (ngSubmit)="demander()" class="auth-form">
            <div class="form-group">
              <label for="identifiant">E-mail ou nom d'utilisateur</label>
              <input id="identifiant" type="text" name="identifiant" [(ngModel)]="identifiant"
                     placeholder="Ex: amira@nextpay.tn ou amira" autocomplete="username"
                     autocapitalize="off" spellcheck="false" required />
            </div>
            <button type="submit" class="btn-submit" [disabled]="envoi()">
              {{ envoi() ? 'Envoi en cours...' : 'Recevoir un code' }}
            </button>
          </form>
        } @else {
          <form (ngSubmit)="changer()" class="auth-form">
            <p class="pour">Code envoyé pour <strong>{{ identifiant }}</strong> ·
              <button type="button" class="lien" (click)="revenir()">Modifier</button>
            </p>

            <div class="form-group">
              <label for="code">Code reçu par e-mail (6 chiffres)</label>
              <input id="code" class="code" type="text" name="code" [(ngModel)]="code"
                     inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]{6}"
                     placeholder="••••••" required />
            </div>

            <div class="form-group">
              <label for="nouveau-mot-de-passe">Nouveau mot de passe</label>
              <app-champ-mot-de-passe inputId="nouveau-mot-de-passe" name="nouveau" [(ngModel)]="nouveau"
                                      autocomplete="new-password" placeholder="Min. 8 caractères" [required]="true" />
              <ul class="criteres" aria-label="Règles du mot de passe">
                @for (c of criteres(); track c.libelle) {
                  <li [class.ok]="c.ok">
                    <span aria-hidden="true">{{ c.ok ? '✓' : '○' }}</span> {{ c.libelle }}
                    <span class="sr-only">{{ c.ok ? '(respecté)' : '(non respecté)' }}</span>
                  </li>
                }
              </ul>
            </div>

            <div class="form-group">
              <label for="confirmation-mot-de-passe">Confirmation du mot de passe</label>
              <app-champ-mot-de-passe inputId="confirmation-mot-de-passe" name="confirmation" [(ngModel)]="confirmation"
                                      autocomplete="new-password" placeholder="Retapez le mot de passe" [required]="true" />
            </div>

            <button type="submit" class="btn-submit" [disabled]="envoi()">
              {{ envoi() ? 'Modification en cours...' : 'Changer le mot de passe' }}
            </button>

            <p class="renvoi">
              Pas reçu de code ?
              <button type="button" class="lien" [disabled]="attente() > 0 || envoi()" (click)="renvoyer()">
                Renvoyer le code
              </button>
              @if (attente() > 0) {
                <span class="attente">(possible dans {{ attente() }} s)</span>
              }
            </p>
          </form>
        }

        <div class="auth-footer">
          <a routerLink="/connexion/login" class="link-bold">Retour à la connexion</a>
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
      h2 { margin: 0; font-size: 22px; font-weight: 600; color: $texte; }
      p { margin: 6px 0 0; font-size: 13px; color: $gris; line-height: 1.45; }
    }

    .etapes {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      li {
        text-align: center;
        font-size: 11.5px;
        font-weight: 600;
        color: $gris;
        padding: 6px 4px;
        border-bottom: 2px solid $bordure;
        &.active { color: $primaire-fonce; border-bottom-color: $primaire; }
      }
    }

    .alert {
      padding: 10px 14px;
      border-radius: $rayon-champ;
      font-size: 12.5px;
      line-height: 1.45;
      &.error { background: $rouge-clair; color: $rouge-fonce; }
      &.success { background: $vert-clair; color: $vert-fonce; }
    }

    .auth-form {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .pour {
      margin: 0;
      font-size: 12.5px;
      color: $gris;
      strong { color: $texte; font-weight: 600; word-break: break-all; }
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 6px;

      label { font-size: 12px; font-weight: 600; color: $texte; }

      > input {
        width: 100%;
        min-height: 44px;
        padding: 0 14px;
        border: 1px solid $bordure-champ;
        border-radius: $rayon-champ;
        font-size: 13.5px;
        color: $texte;
        outline: none;
        transition: border-color 0.15s ease;
        &:focus { border-color: $primaire; }
      }

      > input.code {
        font-size: 20px;
        letter-spacing: 8px;
        text-align: center;
        font-variant-numeric: tabular-nums;
      }
    }

    .criteres {
      list-style: none;
      margin: 2px 0 0;
      padding: 0;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 2px 12px;
      font-size: 11.5px;
      color: $gris;
      li.ok { color: $vert-fonce; }
    }

    .btn-submit {
      margin-top: 4px;
      min-height: 44px;
      border: 0;
      background: $primaire;
      color: #ffffff;
      font-weight: 600;
      font-size: 13px;
      border-radius: $rayon-champ;
      transition: background 0.15s ease;
      cursor: pointer;
      &:hover:not(:disabled) { background: $primaire-fonce; }
      &:disabled { opacity: 0.6; cursor: not-allowed; }
    }

    .lien {
      border: 0;
      background: none;
      padding: 0;
      font: inherit;
      font-weight: 600;
      color: $primaire-fonce;
      cursor: pointer;
      &:hover:not(:disabled) { color: $primaire-tres-fonce; text-decoration: underline; }
      &:focus-visible { outline: 2px solid $primaire; outline-offset: 2px; border-radius: 2px; }
      &:disabled { color: $gris; cursor: not-allowed; }
    }

    .renvoi {
      margin: 0;
      text-align: center;
      font-size: 12.5px;
      color: $gris;
      .attente { margin-left: 4px; font-variant-numeric: tabular-nums; }
    }

    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip: rect(0 0 0 0);
      white-space: nowrap;
    }

    .auth-footer {
      text-align: center;
      font-size: 13px;
      .link-bold {
        color: $primaire-fonce;
        font-weight: 600;
        text-decoration: none;
        &:hover { color: $primaire-tres-fonce; text-decoration: underline; }
      }
    }
  `],
})
export class MotDePasseOubliePage {
  private readonly service = inject(MotDePasseOublieService);
  private readonly router = inject(Router);

  protected readonly etape = signal<1 | 2>(1);
  protected identifiant = '';
  protected code = '';
  protected readonly nouveauSaisi = signal('');
  protected confirmation = '';
  protected readonly envoi = signal(false);
  protected readonly info = signal('');
  protected readonly erreur = signal('');
  /** Secondes restantes avant de pouvoir renvoyer un code. */
  protected readonly attente = signal(0);

  protected readonly criteres = computed(() =>
    CRITERES.map((c) => ({ libelle: c.libelle, ok: c.test(this.nouveauSaisi()) })),
  );

  private minuteur: ReturnType<typeof setInterval> | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.arreterMinuteur());
  }

  protected get nouveau(): string {
    return this.nouveauSaisi();
  }
  protected set nouveau(valeur: string) {
    this.nouveauSaisi.set(valeur);
  }

  protected demander(): void {
    const identifiant = this.identifiant.trim();
    if (!identifiant) {
      this.erreur.set("Veuillez saisir votre e-mail ou votre nom d'utilisateur.");
      return;
    }
    this.identifiant = identifiant;
    this.envoyerCode(() => this.etape.set(2));
  }

  protected renvoyer(): void {
    if (this.attente() > 0) return;
    this.envoyerCode(() => (this.code = ''));
  }

  protected revenir(): void {
    this.etape.set(1);
    this.info.set('');
    this.erreur.set('');
  }

  protected changer(): void {
    const code = this.code.trim();
    const manquants = CRITERES.filter((c) => !c.test(this.nouveau)).map((c) => c.libelle.toLowerCase());
    if (!/^\d{6}$/.test(code)) {
      this.erreur.set('Le code doit contenir 6 chiffres.');
      return;
    }
    if (manquants.length) {
      this.erreur.set(`Mot de passe trop faible : il doit contenir ${manquants.join(', ')}.`);
      return;
    }
    if (this.nouveau !== this.confirmation) {
      this.erreur.set('La confirmation ne correspond pas au nouveau mot de passe.');
      return;
    }
    this.envoi.set(true);
    this.erreur.set('');
    this.info.set('');
    this.service.reinitialiser(this.identifiant, code, this.nouveau).subscribe({
      next: () => {
        this.envoi.set(false);
        this.router.navigate(['/connexion/login'], { queryParams: { motDePasseModifie: 1 } });
      },
      error: (e: HttpErrorResponse) => {
        this.envoi.set(false);
        const corps = e.error as ErreurReinitialisation | null;
        this.erreur.set(
          e.status === 400 && corps?.error
            ? corps.error
            : 'Le service est momentanément indisponible. Réessayez dans quelques instants.',
        );
      },
    });
  }

  private envoyerCode(ensuite: () => void): void {
    this.envoi.set(true);
    this.erreur.set('');
    this.info.set('');
    this.service.demanderCode(this.identifiant).subscribe({
      next: () => {
        this.envoi.set(false);
        this.info.set(`${MESSAGE_ENVOYE} Il est valable 10 minutes.`); // même message que le compte existe ou non
        ensuite();
        this.demarrerMinuteur();
      },
      error: () => {
        this.envoi.set(false);
        this.erreur.set('Le service est momentanément indisponible. Réessayez dans quelques instants.');
      },
    });
  }

  private demarrerMinuteur(): void {
    this.arreterMinuteur();
    this.attente.set(DELAI_RENVOI);
    this.minuteur = setInterval(() => {
      this.attente.update((s) => s - 1);
      if (this.attente() <= 0) this.arreterMinuteur();
    }, 1000);
  }

  private arreterMinuteur(): void {
    if (this.minuteur) clearInterval(this.minuteur);
    this.minuteur = null;
  }
}
