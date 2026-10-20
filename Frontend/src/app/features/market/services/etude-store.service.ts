import { Injectable, computed, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';

import { ApiError } from '../../../core/http/api-error';
import { NotificationService } from '../../../core/notifications/notification.service';
import { messageErreur } from '../utils/form';
import { ComparaisonPrix, EtudeMarcheDetail, OpportunitesMenaces } from '../models/market.models';
import { MarketApiService } from './market-api.service';

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

  readonly id = this._id.asReadonly();
  readonly estBrouillon = computed(() => this.etude()?.statut === 'brouillon');

  /** Charge l'étude, puis la comparaison des prix et l'analyse en parallèle. */
  charger(id: number): void {
    const premierChargement = this._id() !== id || !this.etude();
    this._id.set(id);
    if (premierChargement) this.chargement.set(true);
    this.erreur.set(null);

    forkJoin({
      etude: this.api.lireEtude(id),
      comparaison: this.api.comparaisonPrix(id),
      analyse: this.api.opportunitesMenaces(id),
    }).subscribe({
      next: ({ etude, comparaison, analyse }) => {
        this.etude.set(etude);
        this.comparaison.set(comparaison);
        this.analyse.set(analyse);
        this.chargement.set(false);
      },
      error: (e: unknown) => {
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
    this.finalisationEnCours.set(true);
    this.api.finaliserEtude(id).subscribe({
      next: () => {
        this.finalisationEnCours.set(false);
        this.notifications.succes('Étude finalisée : le rapport est désormais figé.');
        this.recharger();
      },
      error: (e: unknown) => {
        this.finalisationEnCours.set(false);
        this.notifications.erreur(messageErreur(e, "Impossible de finaliser l'étude."));
      },
    });
  }

  /** Télécharge le rapport PDF généré par le Market-Service. */
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
