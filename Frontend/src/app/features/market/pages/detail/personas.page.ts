import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { NotificationService } from '../../../../core/notifications/notification.service';
import { ConfirmModalComponent } from '../../../../shared/components/confirm-modal.component';
import { EmptyStateComponent } from '../../../../shared/components/empty-state.component';
import { IconComponent } from '../../../../shared/components/icon.component';
import { InitialesPipe, LignesPipe, MontantPipe } from '../../pipes/format.pipes';
import { lignes } from '../../utils/format';
import { messageErreur } from '../../utils/form';
import { CarteLieuxComponent } from '../../components/carte-lieux.component';
import { PersonaModalComponent } from '../../components/persona-modal.component';
import { Persona } from '../../models/market.models';
import { EtudeStore } from '../../services/etude-store.service';
import { GeocodageService, PointCarte, regrouperParLieu } from '../../services/geocodage.service';
import { MarketApiService } from '../../services/market-api.service';

/** Couleurs des pastilles des personas, dans l'ordre des maquettes. */
const COULEURS = [
  { fond: '#E3F0F1', texte: '#1F6470' },
  { fond: '#E8F5EE', texte: '#24704C' },
  { fond: '#FDF0DC', texte: '#9A5B07' },
];

/** Onglet « Personas » (maquette Main.dc.html). */
@Component({
  selector: 'app-personas',
  imports: [RouterLink, CarteLieuxComponent, ConfirmModalComponent, EmptyStateComponent, IconComponent, PersonaModalComponent, InitialesPipe, LignesPipe, MontantPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './personas.page.html',
  styleUrl: './personas.page.scss',
})
export class PersonasPage {
  protected readonly store = inject(EtudeStore);
  private readonly api = inject(MarketApiService);
  private readonly notifications = inject(NotificationService);
  private readonly geocodage = inject(GeocodageService);

  protected readonly couleurs = COULEURS;
  protected readonly personas = computed(() => this.store.etude()?.personas ?? []);

  /** Carte des personas : un marqueur par localisation, infobulle avec les personas qui y vivent. */
  protected readonly localisations = computed(() => regrouperParLieu(this.personas(), (p) => p.localisation, (p) => p.nom));
  protected readonly pointsPersonas = signal<PointCarte[]>([]);
  protected readonly localisationEnCours = signal(false);
  private versionCarte = 0;

  constructor() {
    effect(() => {
      const localisations = this.localisations();
      const version = ++this.versionCarte;
      this.localisationEnCours.set(true);
      this.geocodage.placer(localisations, 'lieu').then((points) => {
        if (version !== this.versionCarte) return;
        this.pointsPersonas.set(points);
        this.localisationEnCours.set(false);
      });
    });
  }

  /**
   * « Ce qui rassemble vos personas » : besoins cités par au moins deux personas
   * (comparaison sans casse ni espaces superflus). Rien d'inventé : liste vide sinon.
   */
  protected readonly besoinsCommuns = computed(() => {
    const occurrences = new Map<string, { texte: string; personas: number }>();
    for (const persona of this.personas()) {
      const vus = new Set<string>();
      for (const besoin of lignes(persona.besoins)) {
        const cle = besoin.toLocaleLowerCase('fr').replace(/\s+/g, ' ').replace(/[.\s]+$/, '');
        if (!cle || vus.has(cle)) continue;
        vus.add(cle);
        const entree = occurrences.get(cle) ?? { texte: besoin.replace(/[.\s]+$/, ''), personas: 0 };
        entree.personas += 1;
        occurrences.set(cle, entree);
      }
    }
    return [...occurrences.values()].filter((e) => e.personas >= 2).map((e) => e.texte);
  });

  /** null : fermée ; { persona: null } : création ; { persona } : modification. */
  protected readonly modal = signal<{ persona: Persona | null } | null>(null);
  protected readonly aSupprimer = signal<Persona | null>(null);
  protected readonly suppressionEnCours = signal(false);

  protected apresEnregistrement(): void {
    this.modal.set(null);
    this.store.recharger();
  }

  protected supprimer(): void {
    const persona = this.aSupprimer();
    if (!persona) return;
    this.suppressionEnCours.set(true);
    this.api.supprimerPersona(persona.id).subscribe({
      next: () => {
        this.suppressionEnCours.set(false);
        this.aSupprimer.set(null);
        this.notifications.succes(`Le persona « ${persona.nom} » a été supprimé.`);
        this.store.recharger();
      },
      error: (e: unknown) => {
        this.suppressionEnCours.set(false);
        this.notifications.erreur(messageErreur(e, 'Impossible de supprimer ce persona.'));
      },
    });
  }
}
