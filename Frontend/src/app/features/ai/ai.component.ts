import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

/**
 * Composant racine du module Co-Fondateur IA.
 * Enveloppe toutes les pages du module et applique les styles communs.
 */
@Component({
  selector: 'app-ai',
  imports: [RouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<router-outlet />`,
  styles: `
    :host {
      display: block;
      width: 100%;
    }
  `,
})
export class AiComponent {}

