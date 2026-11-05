import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
  inject,
  input,
  output,
} from '@angular/core';

import { IconComponent } from '../../../shared/components/icon.component';

let compteur = 0;

/**
 * Fenêtre modale (maquette Modales.dc.html) : en-tête avec titre et croix,
 * corps et pied projetés. Échap ou clic sur le fond la ferment.
 *
 * <app-modal titre="Ajouter un persona" (fermer)="...">
 *   ...corps...
 *   <ng-container pied> ...boutons... </ng-container>
 * </app-modal>
 */
@Component({
  selector: 'app-modal',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'fermer.emit()' },
  template: `
    <div class="fond" (click)="fermer.emit()"></div>
    <div class="fenetre" role="dialog" aria-modal="true" [attr.aria-labelledby]="idTitre" [style.max-width.px]="largeur()">
      <div class="entete">
        <h2 [id]="idTitre">{{ titre() }}</h2>
        <button type="button" class="btn-icone" aria-label="Fermer" (click)="fermer.emit()">
          <app-icon nom="fermer" />
        </button>
      </div>
      <div class="corps"><ng-content /></div>
      <div class="pied"><ng-content select="[pied]" /></div>
    </div>
  `,
  styles: `
    :host {
      position: fixed;
      inset: 0;
      z-index: 100;
      display: flex;
      align-items: flex-start;
      justify-content: center;
      padding: 48px 16px;
      overflow-y: auto;
    }
    .fond {
      position: fixed;
      inset: 0;
      background: rgba(29, 43, 47, 0.55);
    }
    .fenetre {
      position: relative;
      width: 100%;
      background: #ffffff;
      border-radius: 16px;
      box-shadow: 0 24px 60px rgba(10, 25, 30, 0.3);
      display: flex;
      flex-direction: column;
    }
    .entete {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 20px 24px;
      border-bottom: 1px solid #eef2f3;
    }
    h2 {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
    }
    .corps {
      padding: 20px 24px;
    }
    .pied {
      display: flex;
      justify-content: flex-end;
      flex-wrap: wrap;
      gap: 10px;
      padding: 16px 24px;
      border-top: 1px solid #eef2f3;
    }
  `,
})
export class ModalComponent {
  readonly titre = input.required<string>();
  readonly largeur = input(600);
  readonly fermer = output<void>();
  protected readonly idTitre = `titre-modal-${++compteur}`;

  constructor() {
    const element = inject<ElementRef<HTMLElement>>(ElementRef);
    // Place le focus dans le premier champ à l'ouverture
    afterNextRender(() => {
      const champ = element.nativeElement.querySelector<HTMLElement>(
        '.corps input, .corps select, .corps textarea, .corps button',
      );
      champ?.focus();
    });
  }
}
