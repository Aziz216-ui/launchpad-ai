import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { catchError, forkJoin, map, of } from 'rxjs';

import { NotificationService } from '../../../../core/notifications/notification.service';
import { BadgeComponent } from '../../../../shared/components/badge.component';
import { ConfirmModalComponent } from '../../../../shared/components/confirm-modal.component';
import { EmptyStateComponent } from '../../../../shared/components/empty-state.component';
import { IconComponent } from '../../../../shared/components/icon.component';
import { LoaderComponent } from '../../../../shared/components/loader.component';
import { messageErreur } from '../../utils/form';
import { NIVEAUX, ORDRE_NIVEAUX, STATUTS } from '../../models/libelles';
import { EtudeMarche, NiveauConcurrence } from '../../models/market.models';
import { MarketApiService } from '../../services/market-api.service';

type Filtre = 'toutes' | 'brouillon' | 'finalisee';
type Tri = 'recent' | 'nom' | 'niveau';

/** Liste des études de marché (maquettes Liste.dc.html et Liste-vide.dc.html). */
@Component({
  selector: 'app-etude-liste',
  imports: [
    RouterLink,
    DatePipe,
    BadgeComponent,
    ConfirmModalComponent,
    EmptyStateComponent,
    IconComponent,
    LoaderComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './etude-liste.page.html',
  styleUrl: './etude-liste.page.scss',
})
export class EtudeListePage {
  private readonly api = inject(MarketApiService);
  private readonly notifications = inject(NotificationService);

  /** Recherche saisie dans l'en-tête (?q=). */
  readonly q = input<string>();

  protected readonly statuts = STATUTS;
  protected readonly niveauxLibelles = NIVEAUX;

  protected readonly etudes = signal<EtudeMarche[]>([]);
  /** Niveau de concurrence de chaque étude (chargé après la liste). */
  protected readonly niveaux = signal<Record<number, NiveauConcurrence>>({});
  protected readonly chargement = signal(true);
  protected readonly erreur = signal<string | null>(null);
  protected readonly filtre = signal<Filtre>('toutes');
  protected readonly tri = signal<Tri>('recent');
  protected readonly aSupprimer = signal<EtudeMarche | null>(null);
  protected readonly suppressionEnCours = signal(false);

  protected readonly nbFinalisees = computed(() => this.etudes().filter((e) => e.statut === 'finalisee').length);
  protected readonly nbBrouillons = computed(() => this.etudes().filter((e) => e.statut === 'brouillon').length);

  protected readonly filtres = computed(() => [
    { id: 'toutes' as Filtre, libelle: `Toutes · ${this.etudes().length}` },
    { id: 'brouillon' as Filtre, libelle: `Brouillon · ${this.nbBrouillons()}` },
    { id: 'finalisee' as Filtre, libelle: `Finalisée · ${this.nbFinalisees()}` },
  ]);

  protected readonly visibles = computed(() => {
    const filtre = this.filtre();
    const niveaux = this.niveaux();
    const liste = this.etudes().filter((e) => filtre === 'toutes' || e.statut === filtre);
    switch (this.tri()) {
      case 'nom':
        return [...liste].sort((a, b) => a.titre.localeCompare(b.titre, 'fr'));
      case 'niveau':
        return [...liste].sort(
          (a, b) =>
            ORDRE_NIVEAUX.indexOf(niveaux[a.id] ?? 'inconnu') - ORDRE_NIVEAUX.indexOf(niveaux[b.id] ?? 'inconnu'),
        );
      default:
        return [...liste].sort((a, b) => b.date_mise_a_jour.localeCompare(a.date_mise_a_jour));
    }
  });

  constructor() {
    // Recharge à chaque changement de la recherche
    effect(() => {
      const recherche = this.q();
      untracked(() => this.charger(recherche));
    });
  }

  protected charger(recherche = this.q()): void {
    this.chargement.set(true);
    this.erreur.set(null);
    this.api.listerEtudes({ search: recherche?.trim() }).subscribe({
      next: (etudes) => {
        this.etudes.set(etudes);
        this.chargement.set(false);
        this.chargerNiveaux(etudes);
      },
      error: (e: unknown) => {
        this.erreur.set(messageErreur(e, 'Impossible de charger vos études de marché.'));
        this.chargement.set(false);
      },
    });
  }

  /** L'API ne renvoie pas le niveau dans la liste : une requête légère par étude. */
  private chargerNiveaux(etudes: EtudeMarche[]): void {
    if (!etudes.length) return;
    forkJoin(
      etudes.map((e) =>
        this.api.opportunitesMenaces(e.id).pipe(
          map((analyse) => [e.id, analyse.niveau_concurrence] as const),
          catchError(() => of([e.id, 'inconnu'] as const)),
        ),
      ),
    ).subscribe((paires) => this.niveaux.set(Object.fromEntries(paires)));
  }

  protected barre(niveau: NiveauConcurrence | undefined, rang: number): string {
    const infos = NIVEAUX[niveau ?? 'inconnu'];
    return rang <= infos.barres ? infos.couleur : '#D5DDE0';
  }

  protected changerTri(valeur: string): void {
    this.tri.set(valeur as Tri);
  }

  protected supprimer(): void {
    const etude = this.aSupprimer();
    if (!etude) return;
    this.suppressionEnCours.set(true);
    this.api.supprimerEtude(etude.id).subscribe({
      next: () => {
        this.suppressionEnCours.set(false);
        this.aSupprimer.set(null);
        this.etudes.update((liste) => liste.filter((e) => e.id !== etude.id));
        this.notifications.succes(`L'étude « ${etude.titre} » a été supprimée.`);
      },
      error: (e: unknown) => {
        this.suppressionEnCours.set(false);
        this.notifications.erreur(messageErreur(e, "Impossible de supprimer l'étude."));
      },
    });
  }
}
