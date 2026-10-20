import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { IconComponent } from './icon.component';

/**
 * Confirmation avant une action irréversible (maquette « Supprimer cette étude ? »).
 * Le message est découpé en avant / nom en gras / après.
 */
@Component({
  selector: 'app-confirm-modal',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'annuler.emit()' },
  template: `
    <div class="fond" (click)="annuler.emit()"></div>
    <div class="fenetre" role="alertdialog" aria-modal="true" aria-labelledby="titre-confirmation"
      aria-describedby="texte-confirmation">
      <span class="icone"><app-icon nom="corbeille" [taille]="22" /></span>
      <h2 id="titre-confirmation">{{ titre() }}</h2>
      <p id="texte-confirmation">
        {{ avant() }}@if (nom()) {<strong>« {{ nom() }} »</strong>}{{ apres() }}
      </p>
      <div class="boutons">
        <button type="button" class="secondaire" (click)="annuler.emit()" [disabled]="enCours()">Annuler</button>
        <button type="button" class="danger" (click)="confirmer.emit()" [disabled]="enCours()">
          {{ enCours() ? 'Suppression…' : libelleConfirmer() }}
        </button>
      </div>
    </div>
  `,
  styles: `
    :host {
      position: fixed;
      inset: 0;
      z-index: 110;
      display: flex;
      align-items: flex-start;
      justify-content: center;
      padding: 120px 16px 16px;
    }
    .fond {
      position: fixed;
      inset: 0;
      background: rgba(29, 43, 47, 0.55);
    }
    .fenetre {
      position: relative;
      width: 440px;
      max-width: 100%;
      background: #ffffff;
      border-radius: 16px;
      box-shadow: 0 24px 60px rgba(10, 25, 30, 0.3);
      padding: 24px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .icone {
      width: 48px;
      height: 48px;
      border-radius: 12px;
      background: #fbe7e7;
      color: #b23a3a;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    h2 {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
    }
    p {
      margin: 0;
      font-size: 13px;
      line-height: 1.6;
      color: #3d5257;
    }
    .boutons {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
    }
    button {
      min-height: 44px;
      padding: 0 16px;
      border-radius: 10px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
    }
    button:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    .secondaire {
      border: 1px solid #cfd8db;
      background: #ffffff;
      color: #1d2b2f;
    }
    .danger {
      padding: 0 18px;
      border: 0;
      background: #b23a3a;
      color: #ffffff;
    }
  `,
})
export class ConfirmModalComponent {
  readonly titre = input.required<string>();
  readonly avant = input('');
  readonly nom = input('');
  readonly apres = input('');
  readonly libelleConfirmer = input('Supprimer');
  readonly enCours = input(false);
  readonly confirmer = output<void>();
  readonly annuler = output<void>();
}
