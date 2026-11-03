import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';

import { BadgeComponent } from '../../../../shared/components/badge.component';
import { LoaderComponent } from '../../../../shared/components/loader.component';
import { LignesPipe, MontantPipe, PourcentagePipe } from '../../pipes/format.pipes';
import { formatMontant, formatPourcentage } from '../../utils/format';
import { NIVEAUX, POTENTIELS } from '../../models/libelles';
import { RapportEtude } from '../../models/market.models';
import { EtudeStore } from '../../services/etude-store.service';
import { MarketApiService } from '../../services/market-api.service';

/** Longueur de l'arc de la jauge (demi-cercle de rayon 70). */
const LONGUEUR_ARC = 220;

/** Onglet « Aperçu » (maquette Apercu.dc.html). */
@Component({
  selector: 'app-apercu',
  imports: [RouterLink, BadgeComponent, LoaderComponent, MontantPipe, PourcentagePipe, LignesPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './apercu.page.html',
  styleUrl: './apercu.page.scss',
})
export class ApercuPage {
  protected readonly store = inject(EtudeStore);
  private readonly api = inject(MarketApiService);

  protected readonly niveaux = NIVEAUX;
  protected readonly potentiels = POTENTIELS;
  protected readonly longueurArc = LONGUEUR_ARC;

  /** Le potentiel commercial n'est calculé que dans le rapport. */
  protected readonly rapport = signal<RapportEtude | null>(null);
  protected readonly chargementRapport = signal(true);

  protected readonly niveau = computed(() => this.store.analyse()?.niveau_concurrence ?? 'inconnu');

  protected readonly arc = computed(() => {
    const p = this.rapport()?.potentiel_commercial;
    if (!p) return 0;
    return Math.max(0, Math.min(1, p.score / p.score_max)) * LONGUEUR_ARC;
  });

  /** Texte « Votre opportunité », construit à partir de la comparaison des prix. */
  protected readonly opportunite = computed(() => {
    const c = this.store.comparaison();
    const etude = this.store.etude();
    if (!c || !etude || c.prix_propose === null || c.prix_moyen === null || c.ecart_moyenne_pct === null) {
      return null;
    }
    const ecart = c.ecart_moyenne_pct;
    const position =
      ecart < 0 ? 'sous la moyenne' : ecart > 0 ? 'au-dessus de la moyenne' : 'exactement dans la moyenne';
    const valeur = ecart === 0 ? '' : `${formatPourcentage(Math.abs(ecart))} `;
    return `À ${formatMontant(c.prix_propose)}, ${etude.titre} se place ${valeur}${position} des ${c.nombre_concurrents} concurrents analysés (${formatMontant(c.prix_moyen)}).`;
  });

  constructor() {
    // Recharge le potentiel quand l'étude change (après une modification)
    effect(() => {
      const etude = this.store.etude();
      if (!etude) return;
      untracked(() => {
        this.api.rapport(etude.id).subscribe({
          next: (r) => {
            this.rapport.set(r);
            this.chargementRapport.set(false);
          },
          error: () => this.chargementRapport.set(false),
        });
      });
    });
  }
}
