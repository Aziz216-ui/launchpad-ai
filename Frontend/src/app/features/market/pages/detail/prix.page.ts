import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { EmptyStateComponent } from '../../../../shared/components/empty-state.component';
import { MontantPipe, PourcentagePipe } from '../../pipes/format.pipes';
import { formatMontant } from '../../utils/format';
import { POSITIONNEMENTS } from '../../models/libelles';
import { PositionnementPrix } from '../../models/market.models';
import { EtudeStore } from '../../services/etude-store.service';

/** Largeur minimale d'une barre du graphique, en % de la piste. */
const LARGEUR_MINIMALE = 1.5;

const CONSEILS: Record<PositionnementPrix, { titre: string; texte: string } | null> = {
  economique: {
    titre: 'Accessible, sans compromis',
    texte:
      "Votre prix se situe dans la fourchette basse. Validez-le aupr├¿s de vos personas et v├⌐rifiez le co├╗t d'acquisition avant de le confirmer.",
  },
  aligne: {
    titre: 'Dans la moyenne du march├⌐',
    texte: 'Votre prix est align├⌐ sur celui des concurrents : votre diff├⌐rence devra venir de la valeur de votre offre.',
  },
  premium: {
    titre: 'Un prix premium ├á justifier',
    texte: 'Votre prix d├⌐passe la moyenne du march├⌐. Mettez en avant ce qui le justifie aupr├¿s de vos personas.',
  },
  inconnu: null,
};

/** Onglet ┬½ Comparaison des offres et des prix ┬╗ (maquette Prix.dc.html). */
@Component({
  selector: 'app-prix',
  imports: [RouterLink, EmptyStateComponent, MontantPipe, PourcentagePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './prix.page.html',
  styleUrl: './prix.page.scss',
})
export class PrixPage {
  protected readonly store = inject(EtudeStore);
  protected readonly positionnements = POSITIONNEMENTS;

  protected readonly comparaison = computed(() => this.store.comparaison());

  /** ├ëchelle du graphique : le prix le plus haut (concurrents et offre) occupe 98 % de la barre. */
  private readonly echelle = computed(() => {
    const c = this.comparaison();
    if (!c) return 1;
    const max = Math.max(c.prix_max ?? 0, c.prix_propose ?? 0);
    return max > 0 ? 98 / max : 1;
  });

  protected readonly barres = computed(() => {
    const c = this.comparaison();
    if (!c) return [];
    // Le graphique de la maquette garde l'ordre du tableau des concurrents (prix croissants)
    return c.concurrents.map((x) => ({ nom: x.nom, prix: x.prix_moyen, largeur: x.prix_moyen * this.echelle() }));
  });

  /** Largeur affich├⌐e : un prix ├á 0 Γé¼ garde une barre visible (largeur minimale). */
  protected largeurVisible(largeur: number): number {
    return Math.max(largeur, LARGEUR_MINIMALE);
  }

  /** Carte de conseil d├⌐duite du positionnement prix (maquette ┬½ Accessible, sans compromis ┬╗). */
  protected readonly conseil = computed(() => {
    const c = this.comparaison();
    if (!c || c.prix_propose === null) return null;
    return CONSEILS[c.positionnement];
  });

  protected readonly largeurOffre = computed(() => (this.comparaison()?.prix_propose ?? 0) * this.echelle());
  protected readonly positionMoyenne = computed(() => ((this.comparaison()?.prix_moyen ?? 0) * this.echelle()) / 100);

  protected readonly moinsCher = computed(() => this.comparaison()?.concurrents[0]?.nom ?? '');
  protected readonly plusCher = computed(() => {
    const liste = this.comparaison()?.concurrents ?? [];
    return liste[liste.length - 1]?.nom ?? '';
  });

  /** ┬½ Mon offre : ΓêÆ5 Γé¼ ┬╗ : ├⌐cart absolu avec le prix moyen. */
  protected readonly ecartAbsolu = computed(() => {
    const c = this.comparaison();
    if (!c || c.prix_propose === null || c.prix_moyen === null) return null;
    const ecart = c.prix_propose - c.prix_moyen;
    const signe = ecart < 0 ? 'ΓêÆ' : ecart > 0 ? '+' : '';
    return `${signe}${formatMontant(Math.abs(ecart))}`;
  });

  protected readonly descriptionAccessible = computed(() => {
    const c = this.comparaison();
    if (!c) return '';
    return (
      c.concurrents.map((x) => `${x.nom} ${formatMontant(x.prix_moyen)}`).join(', ') +
      (c.prix_propose !== null ? `, mon offre ${formatMontant(c.prix_propose)}` : '') +
      (c.prix_moyen !== null ? `. Moyenne ${formatMontant(c.prix_moyen)}.` : '.')
    );
  });
}
