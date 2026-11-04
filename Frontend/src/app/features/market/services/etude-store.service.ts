import { Injectable, computed, inject, signal } from '@angular/core';
import { forkJoin, switchMap, timer } from 'rxjs';

import { ApiError } from '../../../core/http/api-error';
import { NotificationService } from '../../../core/notifications/notification.service';
import { messageErreur } from '../utils/form';
import { ComparaisonPrix, EtudeMarcheDetail, OpportunitesMenaces } from '../models/market.models';
import { MarketApiService } from './market-api.service';

/** Délai entre deux vérifications de la SWOT générée par swot-service (RabbitMQ). */
const DELAI_SWOT_MS = 2500;
const ESSAIS_SWOT = 6;

/**
 * État de l'étude ouverte, partagé par l'en-tête et tous les onglets.
 * Fourni au niveau de la page détail : chaque étude ouverte a son propre store.
 */
@Injectable()
export class EtudeStore {
  private readonly api = inject(MarketApiService);
  private readonly notifications = inject(NotificationService);

  private readonly _id = signal<number | null>(null);
  readonly etude = signal<EtudeMarcheDetail | null>(null);
  readonly comparaison = signal<ComparaisonPrix | null>(null);
  readonly analyse = signal<OpportunitesMenaces | null>(null);
  readonly chargement = signal(true);
  readonly erreur = signal<string | null>(null);
  readonly telechargementEnCours = signal(false);
  readonly finalisationEnCours = signal(false);
  /** true quand la SWOT a été générée automatiquement après la finalisation. */
  readonly swotGenereeAutomatiquement = signal(false);

  readonly id = this._id.asReadonly();
  /** Numéro du dernier chargement demandé : une réponse plus ancienne arrivée en retard est ignorée. */
  private chargementCourant = 0;
  readonly estBrouillon = computed(() => this.etude()?.statut === 'brouillon');

  /** Charge l'étude, puis la comparaison des prix et l'analyse en parallèle. */
  charger(id: number): void {
    if (!Number.isInteger(id) || id <= 0) {
      // Identifiant de route absent ou invalide (ex. /etude-marche/abc) : aucun appel au serveur
      this.etude.set(null);
      this.erreur.set("Cette étude de marché n'existe pas ou a été supprimée.");
      this.chargement.set(false);
      return;
    }
    const premierChargement = this._id() !== id || !this.etude();
    const numero = ++this.chargementCourant;
    this._id.set(id);
    if (premierChargement) this.chargement.set(true);
    this.erreur.set(null);

    forkJoin({
      etude: this.api.lireEtude(id),
      comparaison: this.api.comparaisonPrix(id),
      analyse: this.api.opportunitesMenaces(id),
    }).subscribe({
      next: ({ etude, comparaison, analyse }) => {
        if (numero !== this.chargementCourant) return; // réponse périmée (rechargements rapprochés)
        this.etude.set(etude);
        this.comparaison.set(comparaison);
        this.analyse.set(analyse);
        this.chargement.set(false);
      },
      error: (e: unknown) => {
        if (numero !== this.chargementCourant) return;
        this.erreur.set(
          e instanceof ApiError && e.statut === 404
            ? "Cette étude de marché n'existe pas ou a été supprimée."
            : messageErreur(e, "Impossible de charger l'étude."),
        );
        this.chargement.set(false);
      },
    });
  }

  /** À appeler après chaque modification pour rafraîchir tous les onglets. */
  recharger(): void {
    const id = this._id();
    if (id !== null) this.charger(id);
  }

  finaliser(): void {
    const id = this._id();
    if (id === null) return;
    // Éléments automatiques avant la finalisation : la génération les remplace par de nouveaux
    const avant = new Set((this.etude()?.swot ?? []).filter((e) => e.genere_automatiquement).map((e) => e.id));
    this.finalisationEnCours.set(true);
    this.swotGenereeAutomatiquement.set(false);
    this.api.finaliserEtude(id).subscribe({
      next: () => {
        this.finalisationEnCours.set(false);
        this.notifications.succes('Étude finalisée : la SWOT va être générée automatiquement.');
        this.recharger();
        this.attendreSwotAutomatique(id, avant, 1);
      },
      error: (e: unknown) => {
        this.finalisationEnCours.set(false);
        this.notifications.erreur(messageErreur(e, "Impossible de finaliser l'étude."));
      },
    });
  }

  /**
   * Après la finalisation, le serveur publie etude.finalisee et swot-service génère la SWOT
   * (asynchrone, RabbitMQ). On relit l'étude toutes les 2,5 s jusqu'à voir les nouveaux éléments.
   */
  private attendreSwotAutomatique(id: number, avant: Set<number>, essai: number): void {
    timer(DELAI_SWOT_MS)
      .pipe(switchMap(() => this.api.lireEtude(id)))
      .subscribe({
        next: (etude) => {
          if (this._id() !== id) return; // une autre étude a été ouverte entre-temps
          this.chargementCourant++; // la SWOT générée remplace toute réponse plus ancienne
          const nouveaux = etude.swot.some((e) => e.genere_automatiquement && !avant.has(e.id));
          if (nouveaux) {
            this.etude.set(etude);
            this.swotGenereeAutomatiquement.set(true);
            this.notifications.succes('SWOT générée automatiquement.');
          } else if (essai < ESSAIS_SWOT) {
            this.attendreSwotAutomatique(id, avant, essai + 1);
          } else {
            this.notifications.info("La SWOT n'est pas encore disponible : réessayez dans un instant ou utilisez « Générer la SWOT ».");
          }
        },
        error: () => {
          // Erreur déjà signalée par l'intercepteur (503...) : pas de nouvel essai
        },
      });
  }

  /** Télécharge le rapport PDF généré par le serveur (etude-service). */
  telechargerPdf(): void {
    const id = this._id();
    if (id === null) return;
    this.telechargementEnCours.set(true);
    this.api.rapportPdf(id).subscribe({
      next: (pdf) => {
        const lien = document.createElement('a');
        lien.href = URL.createObjectURL(pdf);
        lien.download = `etude-marche-${id}.pdf`;
        lien.click();
        setTimeout(() => URL.revokeObjectURL(lien.href), 1000);
        this.telechargementEnCours.set(false);
        this.notifications.succes('Rapport PDF téléchargé.');
      },
      error: (e: unknown) => {
        this.telechargementEnCours.set(false);
        this.notifications.erreur(messageErreur(e, 'Impossible de générer le rapport PDF.'));
      },
    });
  }
}
