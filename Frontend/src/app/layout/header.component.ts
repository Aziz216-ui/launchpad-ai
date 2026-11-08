import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';

import { IconComponent } from '../shared/components/icon.component';

/** En-tête commun : recherche, espace, notifications et avatar. */
@Component({
  selector: 'app-header',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form class="recherche" role="search" (submit)="rechercher($event, champ.value)">
      <app-icon nom="recherche" [taille]="16" />
      <label for="recherche-globale" class="masque">Rechercher</label>
      <input #champ id="recherche-globale" type="search" placeholder="Rechercher dans mon espace…" />
    </form>
    <span class="espaceur"></span>
    <span class="espace">Espace entrepreneur</span>
    <button type="button" class="notifications" aria-label="Notifications (bientôt disponibles)"
      title="Notifications bientôt disponibles">
      <app-icon nom="cloche" />
    </button>
    <span class="avatar" aria-hidden="true">E</span>
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
    .notifications {
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

  /**
   * Ajoute ?q=<texte> à l'URL de la page courante. Chaque module décide s'il
   * l'utilise (ex. la liste des études de marché filtre par titre) ou l'ignore.
   */
  protected rechercher(evenement: Event, texte: string): void {
    evenement.preventDefault();
    const q = texte.trim();
    this.router.navigate([], { queryParams: { q: q || null }, queryParamsHandling: 'merge' });
  }
}
