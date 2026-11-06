import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';
import { RouterOutlet } from '@angular/router';

/**
 * Racine du module « Étude de marché » : enveloppe tous ses écrans.
 *
 * Ses styles (market.component.scss) ne sont pas encapsulés pour être partagés
 * par les pages et composants du module, mais ils sont tous préfixés par `.market` :
 * ils ne débordent jamais sur les autres modules. Ils sont chargés avec le module (lazy).
 */
@Component({
  selector: 'app-market',
  imports: [RouterOutlet],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'market' },
  template: `<router-outlet />`,
  styleUrl: './market.component.scss',
})
export class MarketComponent {}
