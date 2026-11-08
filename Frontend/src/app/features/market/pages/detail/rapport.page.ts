import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';

import { EmptyStateComponent } from '../../../../shared/components/empty-state.component';
import { IconComponent } from '../../../../shared/components/icon.component';
import { LoaderComponent } from '../../../../shared/components/loader.component';
import { LignesPipe, MontantPipe, NomSecteurPipe, PourcentagePipe } from '../../pipes/format.pipes';
import { lignes } from '../../utils/format';
import { messageErreur } from '../../utils/form';
import { POSITIONNEMENTS, POTENTIELS } from '../../models/libelles';
import { RapportEtude } from '../../models/market.models';
import { EtudeStore } from '../../services/etude-store.service';
import { MarketApiService } from '../../services/market-api.service';

const SECTIONS = [
  'Marché cible',
  'Hypothèses',
  'Concurrents',
  'Comparaison des prix',
  'Personas',
  'Analyse SWOT',
  'Conclusion',
];

/** Onglet « Rapport » (maquette Rapport.dc.html), alimenté par GET /etudes/<id>/rapport/. */
@Component({
  selector: 'app-rapport',
  imports: [DatePipe, EmptyStateComponent, IconComponent, LoaderComponent, LignesPipe, MontantPipe, NomSecteurPipe, PourcentagePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './rapport.page.html',
  styleUrl: './rapport.page.scss',
})
export class RapportPage {
  protected readonly store = inject(EtudeStore);
  private readonly api = inject(MarketApiService);

  protected readonly sections = SECTIONS;
  protected readonly potentiels = POTENTIELS;
  protected readonly positionnements = POSITIONNEMENTS;

  protected readonly rapport = signal<RapportEtude | null>(null);
  protected readonly chargement = signal(true);
  protected readonly erreur = signal<string | null>(null);
  /** Heure de génération du rapport affiché. */
  protected readonly genereLe = signal(new Date());

  protected readonly pourcentagePotentiel = computed(() => {
    const p = this.rapport()?.potentiel_commercial;
    return p ? Math.max(0, Math.min(100, (p.score / p.score_max) * 100)) : 0;
  });

  /** Nombre de pages A4 du PDF généré par le serveur (null tant qu'il n'est pas connu). */
  protected readonly pagesPdf = signal<number | null>(null);

  /**
   * Conclusion rédigée en paragraphe : conclusion du serveur, puis les facteurs du score.
   * Ex. « Potentiel commercial moyen (score 3/7). Il s'appuie sur : forte croissance… ; … »
   */
  protected readonly conclusion = computed(() => {
    const p = this.rapport()?.potentiel_commercial;
    if (!p) return '';
    const facteurs = p.justification.map((j) => j.charAt(0).toLowerCase() + j.slice(1)).join(' ; ');
    return facteurs ? `${p.conclusion} Ce score s'appuie sur les éléments suivants : ${facteurs}.` : p.conclusion;
  });

  /** Échelle des barres de prix : le prix le plus élevé occupe toute la largeur. */
  protected readonly prixMax = computed(() => {
    const c = this.rapport()?.comparaison_prix;
    return Math.max(c?.prix_max ?? 0, c?.prix_propose ?? 0) || 1;
  });

  constructor() {
    // Recharge le rapport quand l'étude a été modifiée
    effect(() => {
      const etude = this.store.etude();
      if (!etude) return;
      untracked(() => this.charger(etude.id));
    });
  }

  private charger(id: number): void {
    this.api.rapport(id).subscribe({
      next: (r) => {
        this.rapport.set(r);
        this.genereLe.set(new Date());
        this.chargement.set(false);
        this.compterPagesPdf(id);
      },
      error: (e: unknown) => {
        this.erreur.set(messageErreur(e, 'Impossible de générer le rapport.'));
        this.chargement.set(false);
      },
    });
  }

  /**
   * « environ N pages A4 » : lit le PDF généré par le serveur et compte ses pages
   * (objets /Type /Page). En cas d'échec, l'information n'est simplement pas affichée.
   */
  private compterPagesPdf(id: number): void {
    this.api.rapportPdf(id).subscribe({
      next: (pdf) =>
        pdf.text().then((contenu) => {
          const pages = contenu.match(/\/Type\s*\/Page(?!s)/g)?.length ?? 0;
          this.pagesPdf.set(pages || null);
        }),
      error: () => this.pagesPdf.set(null),
    });
  }

  /** « 25 – 34 ans, Lyon » : âge et localisation renseignés. */
  protected infosPersona(p: { tranche_age: string; localisation: string }): string {
    return [p.tranche_age, p.localisation].filter((v) => !!v).join(', ');
  }

  /** Résumé d'un persona pour le rapport : premier besoin exprimé. */
  protected besoinPrincipal(besoins: string): string {
    // Sans point final : le gabarit en ajoute un
    return (lignes(besoins)[0] ?? '').replace(/[.\s]+$/, '');
  }

  /** Le sommaire fait défiler la page sans changer de route. */
  protected allerA(index: number): void {
    document.getElementById(`s${index + 1}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
