import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';
import { RouterOutlet } from '@angular/router';

/**
 * Racine du module ┬½ ├ëtude de march├⌐ ┬╗ : enveloppe tous ses ├⌐crans.
 *
 * Ses styles (market.component.scss) ne sont pas encapsul├⌐s pour ├¬tre partag├⌐s
 * par les pages et composants du module, mais ils sont tous pr├⌐fix├⌐s par `.market` :
 * ils ne d├⌐bordent jamais sur les autres modules. Ils sont charg├⌐s avec le module (lazy).
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
