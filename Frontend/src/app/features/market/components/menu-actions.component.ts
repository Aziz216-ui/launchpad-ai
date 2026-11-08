import { ChangeDetectionStrategy, Component, ElementRef, inject, input, signal } from '@angular/core';

import { IconComponent } from '../../../shared/components/icon.component';

/** Hauteur approximative du menu ouvert (3 actions). */
const HAUTEUR_MENU = 150;

/**
 * Bouton « ⋮ » des maquettes ouvrant un petit menu.
 * Les boutons du menu sont projetés ; un clic sur l'un d'eux referme le menu.
 */
@Component({
  selector: 'app-menu-actions',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:click)': 'clicExterieur($event)',
    '(document:keydown.escape)': 'ouvert.set(false)',
  },
  template: `
    <button type="button" class="btn-icone" [attr.aria-label]="libelle()" aria-haspopup="menu"
      [attr.aria-expanded]="ouvert()" (click)="basculer($event)">
      <app-icon nom="options" />
    </button>
    @if (ouvert()) {
      <div class="menu" [class.vers-le-haut]="versLeHaut()" role="menu" (click)="ouvert.set(false)">
        <ng-content />
      </div>
    }
  `,
  styles: `
    :host {
      position: relative;
      display: inline-block;
    }
    .btn-icone {
      width: 44px;
      height: 44px;
      border: 0;
      border-radius: 8px;
      background: transparent;
      color: #5a6a6f;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .btn-icone:hover {
      background: #f1f4f5;
    }
    .menu {
      position: absolute;
      right: 0;
      top: calc(100% + 4px);
      z-index: 20;
      min-width: 200px;
      padding: 6px;
      background: #ffffff;
      border: 1px solid #e3e8ea;
      border-radius: 10px;
      box-shadow: 0 12px 28px rgba(20, 40, 45, 0.12);
      display: flex;
      flex-direction: column;
    }
    .menu.vers-le-haut {
      top: auto;
      bottom: calc(100% + 4px);
    }
    /* Les boutons sont projetés depuis les pages : ::ng-deep limité à ce menu */
    .menu ::ng-deep button {
      min-height: 40px;
      padding: 0 12px;
      border: 0;
      border-radius: 8px;
      background: transparent;
      text-align: left;
      font-size: 13px;
      color: #1d2b2f;
      cursor: pointer;
      white-space: nowrap;
    }
    .menu ::ng-deep button:hover {
      background: #f1f4f5;
    }
    .menu ::ng-deep button.danger {
      color: #b23a3a;
    }
  `,
})
export class MenuActionsComponent {
  readonly libelle = input('Actions');
  protected readonly ouvert = signal(false);
  /** Ouvre le menu vers le haut s'il manque de place en dessous (dernières lignes d'un tableau). */
  protected readonly versLeHaut = signal(false);
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);

  protected basculer(evenement: Event): void {
    if (!this.ouvert()) {
      const bouton = (evenement.currentTarget as HTMLElement).getBoundingClientRect();
      const conteneur = this.element.nativeElement.closest('.tableau-conteneur');
      const limite = conteneur ? conteneur.getBoundingClientRect().bottom : window.innerHeight;
      this.versLeHaut.set(limite - bouton.bottom < HAUTEUR_MENU);
    }
    this.ouvert.set(!this.ouvert());
  }

  protected clicExterieur(evenement: Event): void {
    if (this.ouvert() && !this.element.nativeElement.contains(evenement.target as Node)) {
      this.ouvert.set(false);
    }
  }
}
