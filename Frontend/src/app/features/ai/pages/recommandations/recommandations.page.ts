import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { environment } from '../../../../../environments/environment';
import { BadgeComponent } from '../../../../shared/components/badge.component';
import { EmptyStateComponent } from '../../../../shared/components/empty-state.component';
import { IconComponent } from '../../../../shared/components/icon.component';
import { LoaderComponent } from '../../../../shared/components/loader.component';
import { NotificationService } from '../../../../core/notifications/notification.service';
import { RecommandationApiService } from '../../services/recommandation-api.service';
import { CategorieReco, Recommandation, StatutReco } from '../../models/ai.models';
import { CATEGORIES, PRIORITES, STATUTS_RECO } from '../../models/libelles';

type FiltreCategorie = 'toutes' | CategorieReco;

/**
 * Page « Plan d'action & Recommandations » (maquettes Co-Fondateur IA).
 * Affiche les recommandations filtrées par catégorie, avec actions de statut.
 */
@Component({
  selector: 'app-recommandations',
  imports: [RouterLink, BadgeComponent, EmptyStateComponent, IconComponent, LoaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './recommandations.page.html',
  styleUrl: './recommandations.page.scss',
})
export class RecommandationsPage {
  private readonly api = inject(RecommandationApiService);
  private readonly notifications = inject(NotificationService);

  protected readonly projetId = environment.utilisateur.projetId;
  protected readonly categories = CATEGORIES;
  protected readonly priorites = PRIORITES;
  protected readonly statutsReco = STATUTS_RECO;

  protected readonly recommandations = signal<Recommandation[]>([]);
  protected readonly chargement = signal(true);
  protected readonly erreur = signal<string | null>(null);
  protected readonly generationEnCours = signal(false);
  protected readonly filtreCategorie = signal<FiltreCategorie>('toutes');
  protected readonly actionEnCours = signal<number | null>(null);

  protected readonly onglets: { id: FiltreCategorie; libelle: string }[] = [
    { id: 'toutes', libelle: 'Toutes' },
    { id: 'marche', libelle: 'Marché' },
    { id: 'financier', libelle: 'Financier' },
    { id: 'juridique', libelle: 'Juridique' },
    { id: 'produit', libelle: 'Produit' },
    { id: 'equipe', libelle: 'Équipe' },
  ];

  protected readonly visibles = computed(() => {
    const filtre = this.filtreCategorie();
    const toutes = this.recommandations();
    return filtre === 'toutes' ? toutes : toutes.filter((r) => r.categorie === filtre);
  });

  protected readonly nbCompletes = computed(
    () => this.recommandations().filter((r) => r.statut === 'appliquee').length,
  );

  protected readonly progression = computed(() => {
    const total = this.recommandations().length;
    return total === 0 ? 0 : Math.round((this.nbCompletes() / total) * 100);
  });

  constructor() {
    this.charger();
  }

  protected charger(): void {
    this.chargement.set(true);
    this.erreur.set(null);
    this.api.listerRecommandations(this.projetId).subscribe({
      next: (recos) => {
        this.recommandations.set(recos.sort((a, b) => a.ordre - b.ordre));
        this.chargement.set(false);
      },
      error: () => {
        this.erreur.set('Impossible de charger les recommandations.');
        this.chargement.set(false);
      },
    });
  }

  protected generer(): void {
    this.generationEnCours.set(true);
    this.api.genererRecommandations(this.projetId).subscribe({
      next: (recos) => {
        this.recommandations.set(recos.sort((a, b) => a.ordre - b.ordre));
        this.generationEnCours.set(false);
        this.notifications.succes('Recommandations régénérées avec succès !');
      },
      error: () => {
        this.generationEnCours.set(false);
        this.notifications.erreur('Impossible de régénérer les recommandations.');
      },
    });
  }

  protected changerStatut(reco: Recommandation, statut: StatutReco): void {
    this.actionEnCours.set(reco.id);
    this.api.modifierStatut(reco.id, statut).subscribe({
      next: (mis_a_jour) => {
        this.recommandations.update((liste) =>
          liste.map((r) => (r.id === mis_a_jour.id ? mis_a_jour : r)),
        );
        this.actionEnCours.set(null);
      },
      error: () => {
        this.actionEnCours.set(null);
        this.notifications.erreur('Impossible de modifier le statut.');
      },
    });
  }
}

