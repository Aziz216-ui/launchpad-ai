import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';

import { CentreNotificationsService, Notification } from '../core/notifications/centre-notifications.service';
import { AuthService, Role } from '../core/services/auth.service';
import { IconComponent } from '../shared/components/icon.component';

const ESPACES: Record<Role, string> = {
  ENTREPRENEUR: 'Espace entrepreneur',
  ACCOUNTANT: 'Espace comptable',
  LAWYER: 'Espace avocat',
  FINANCIER: 'Espace financier',
  ADMIN: 'Administration',
};

/** En-tête commun : recherche, espace, notifications et avatar. */
@Component({
  selector: 'app-header',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:click)': 'fermerSiDehors($event)',
    '(document:keydown.escape)': 'ouvert.set(false)',
  },
  template: `
    <form class="recherche" role="search" (submit)="rechercher($event, champ.value)">
      <app-icon nom="recherche" [taille]="16" />
      <label for="recherche-globale" class="masque">Rechercher</label>
      <input #champ id="recherche-globale" type="search" placeholder="Rechercher dans mon espace…" />
    </form>
    <span class="espaceur"></span>
    <span class="espace">{{ espace() }}</span>

    <div class="cloche">
      <button type="button" class="notifications" (click)="basculer()" aria-haspopup="dialog"
        [attr.aria-expanded]="ouvert()" [attr.aria-label]="libelleCloche()" [title]="libelleCloche()">
        <app-icon nom="cloche" />
        @if (notifications.total() > 0) {
          <span class="pastille" aria-hidden="true">{{ notifications.libelleTotal() }}</span>
        }
      </button>

      @if (ouvert()) {
        <section class="panneau" role="dialog" aria-label="Notifications">
          <header>
            <h2>Notifications</h2>
            @if (notifications.elements().length) {
              <button type="button" class="lien" (click)="notifications.toutMarquerLu()">Tout marquer comme lu</button>
            }
          </header>

          @if (notifications.elements().length) {
            <ul>
              @for (n of notifications.elements(); track n.id) {
                <li>
                  <button type="button" class="element" (click)="ouvrir(n)">
                    <span class="pictogramme" [class.auto]="n.automatique" aria-hidden="true">
                      @if (n.automatique) {
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"></path><path d="M14 3v5h5M9 14l2 2 4-4"></path></svg>
                      } @else {
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                      }
                    </span>
                    <span class="texte">
                      <strong>{{ titre(n) }}</strong>
                      <span class="contenu">{{ n.contenu }}</span>
                      <small>{{ n.dossier.reference }} · {{ quand(n.creeLe) }}</small>
                    </span>
                  </button>
                </li>
              }
            </ul>
            @if (notifications.total() > notifications.elements().length) {
              <p class="plus">+ {{ notifications.total() - notifications.elements().length }} autre(s) notification(s) non lue(s)</p>
            }
          } @else if (notifications.erreur()) {
            <p class="vide">Notifications indisponibles pour le moment.</p>
          } @else {
            <div class="vide">
              <app-icon nom="cercle-valide" [taille]="28" />
              <p>Vous êtes à jour : aucune nouvelle notification.</p>
            </div>
          }
        </section>
      }
    </div>

    <span class="avatar" aria-hidden="true">{{ initiales() }}</span>
  `,
  styles: `
    :host {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 16px;
      padding: 12px 32px;
      background: #ffffff;
      border-bottom: 1px solid #e3e8ea;
      position: relative;
      z-index: 50;
    }
    .recherche {
      flex: 1 1 240px;
      max-width: 420px;
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 0 12px;
      min-height: 44px;
      border: 1px solid #e3e8ea;
      border-radius: 10px;
      background: #f8fafa;
      color: #5a6a6f;
    }
    .masque {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip: rect(0 0 0 0);
      white-space: nowrap;
    }
    input {
      border: 0;
      background: transparent;
      font-size: 13px;
      color: #1d2b2f;
      flex: 1;
      min-width: 0;
      outline: none;
    }
    .espaceur {
      flex-grow: 1;
    }
    .espace {
      font-size: 13px;
      color: #5a6a6f;
    }
    .cloche {
      position: relative;
    }
    .notifications {
      position: relative;
      width: 44px;
      height: 44px;
      border: 1px solid #e3e8ea;
      border-radius: 10px;
      background: #ffffff;
      color: #3d5257;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .notifications:hover,
    .notifications[aria-expanded='true'] {
      border-color: #a9c9ce;
      background: #f8fafa;
    }
    .notifications:focus-visible {
      outline: 3px solid rgba(43, 122, 134, 0.35);
      outline-offset: 2px;
    }
    .pastille {
      position: absolute;
      top: -6px;
      right: -6px;
      min-width: 20px;
      height: 20px;
      padding: 0 5px;
      border-radius: 999px;
      border: 2px solid #ffffff;
      background: #b23a3a;
      color: #ffffff;
      font-size: 11px;
      font-weight: 700;
      line-height: 16px;
      text-align: center;
    }
    .panneau {
      position: absolute;
      top: calc(100% + 8px);
      right: 0;
      width: 380px;
      max-width: calc(100vw - 32px);
      max-height: min(520px, calc(100vh - 100px));
      display: flex;
      flex-direction: column;
      border: 1px solid #e3e8ea;
      border-radius: 14px;
      background: #ffffff;
      box-shadow: 0 16px 40px rgba(10, 25, 30, 0.16);
      overflow: hidden;
    }
    .panneau header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 14px 16px;
      border-bottom: 1px solid #eef2f3;
    }
    h2 {
      margin: 0;
      font-size: 15px;
      font-weight: 600;
    }
    .lien {
      border: 0;
      background: none;
      padding: 4px 0;
      color: #1f6470;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
    }
    .lien:hover {
      text-decoration: underline;
    }
    ul {
      list-style: none;
      margin: 0;
      padding: 6px;
      overflow-y: auto;
    }
    .element {
      width: 100%;
      display: flex;
      gap: 12px;
      align-items: flex-start;
      padding: 10px;
      border: 0;
      border-radius: 10px;
      background: none;
      text-align: left;
      cursor: pointer;
      color: #1d2b2f;
    }
    .element:hover,
    .element:focus-visible {
      background: #f4f6f7;
      outline: none;
    }
    .pictogramme {
      flex-shrink: 0;
      width: 34px;
      height: 34px;
      border-radius: 10px;
      background: #e3f0f1;
      color: #1f6470;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .pictogramme.auto {
      background: #fdf3e3;
      color: #9a5b07;
    }
    .texte {
      display: flex;
      flex-direction: column;
      gap: 3px;
      min-width: 0;
    }
    .texte strong {
      font-size: 13px;
      font-weight: 600;
    }
    .contenu {
      font-size: 13px;
      line-height: 1.45;
      color: #3d5257;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    small {
      font-size: 11px;
      color: #5a6a6f;
    }
    .plus {
      margin: 0;
      padding: 10px 16px 14px;
      font-size: 12px;
      color: #5a6a6f;
    }
    .vide {
      margin: 0;
      padding: 28px 16px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      text-align: center;
      font-size: 13px;
      color: #5a6a6f;
    }
    .vide p {
      margin: 0;
    }
    .avatar {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: #e3f0f1;
      color: #1f6470;
      font-size: 12px;
      font-weight: 600;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    @media (max-width: 800px) {
      :host {
        padding: 12px 16px;
      }
      .espace,
      .espaceur,
      .avatar {
        display: none;
      }
      .recherche {
        max-width: none;
      }
    }
  `,
})
export class HeaderComponent {
  private readonly router = inject(Router);
  private readonly hote = inject(ElementRef<HTMLElement>);
  private readonly utilisateur = toSignal(inject(AuthService).currentUser$, { initialValue: null });
  protected readonly notifications = inject(CentreNotificationsService);

  protected readonly ouvert = signal(false);
  protected readonly espace = computed(() => ESPACES[this.utilisateur()?.role ?? 'ENTREPRENEUR'] ?? 'Mon espace');
  protected readonly initiales = computed(() => {
    const u = this.utilisateur();
    const prenom = u?.first_name?.trim();
    const nom = u?.last_name?.trim();
    if (prenom && nom) return (prenom[0] + nom[0]).toUpperCase();
    return (u?.username?.slice(0, 1) ?? 'E').toUpperCase();
  });
  protected readonly libelleCloche = computed(() => {
    const total = this.notifications.total();
    return total ? `Notifications : ${total} non lue(s)` : 'Notifications';
  });

  constructor() {
    this.notifications.demarrer(inject(DestroyRef), this.router);
  }

  /**
   * Ajoute ?q=<texte> à l'URL de la page courante. Chaque module décide s'il
   * l'utilise (ex. la liste des études de marché filtre par titre) ou l'ignore.
   */
  protected rechercher(evenement: Event, texte: string): void {
    evenement.preventDefault();
    const q = texte.trim();
    this.router.navigate([], { queryParams: { q: q || null }, queryParamsHandling: 'merge' });
  }

  protected basculer(): void {
    this.ouvert.update((o) => !o);
    if (this.ouvert()) this.notifications.rafraichir();
  }

  protected fermerSiDehors(evenement: MouseEvent): void {
    if (this.ouvert() && !this.hote.nativeElement.querySelector('.cloche')?.contains(evenement.target as Node)) {
      this.ouvert.set(false);
    }
  }

  protected ouvrir(n: Notification): void {
    this.ouvert.set(false);
    this.notifications.marquerLue(n);
    this.router.navigate(n.lien, { queryParams: { onglet: 'messages' } });
  }

  protected titre(n: Notification): string {
    if (n.automatique) return `Mise à jour · ${n.dossier.startupName || n.dossier.reference}`;
    const auteur = n.roleAuteur === 'ACCOUNTANT' ? 'votre comptable' : "l'entrepreneur";
    return `Message de ${auteur} · ${n.dossier.startupName || n.dossier.reference}`;
  }

  protected quand(date: string): string {
    const minutes = Math.round((Date.now() - new Date(date).getTime()) / 60000);
    if (minutes < 1) return "à l'instant";
    if (minutes < 60) return `il y a ${minutes} min`;
    if (minutes < 24 * 60) return `il y a ${Math.round(minutes / 60)} h`;
    return new DatePipe('fr').transform(date, 'd MMM, HH:mm') ?? '';
  }
}
