import { Injectable, computed, inject, signal } from '@angular/core';

import { Prevision } from '../models/finance.models';
import { FinanceApiService } from './finance-api.service';

const CLE_PROJET = 'launchpad.finance.projetId';

/**
 * État partagé des écrans Finance : projet courant (UUID) et ses prévisions.
 *
 * Le projet est un UUID car le Finance-Service référence le projet par identifiant seulement.
 * En attendant le User-Service, il est conservé dans le navigateur ; un nouvel UUID suffit pour
 * démarrer un projet vierge.
 */
@Injectable({ providedIn: 'root' })
export class FinanceStore {
  private readonly api = inject(FinanceApiService);

  readonly projetId = signal<string>(projetInitial());
  readonly previsions = signal<Prevision[]>([]);
  readonly chargement = signal(false);
  readonly erreur = signal<string | null>(null);

  /** Prévision sélectionnée ; à défaut, la plus récente (le backend trie du plus récent au plus ancien). */
  private readonly previsionChoisie = signal<string | null>(null);
  readonly prevision = computed<Prevision | null>(() => {
    const liste = this.previsions();
    return liste.find((p) => p.previsionId === this.previsionChoisie()) ?? liste[0] ?? null;
  });

  choisirPrevision(previsionId: string): void {
    this.previsionChoisie.set(previsionId);
  }

  changerProjet(projetId: string): void {
    this.projetId.set(projetId);
    this.previsionChoisie.set(null);
    memoriser(projetId);
    this.recharger();
  }

  nouveauProjet(): void {
    this.changerProjet(crypto.randomUUID());
  }

  recharger(): void {
    this.chargement.set(true);
    this.erreur.set(null);
    this.api.listerPrevisions(this.projetId()).subscribe({
      next: (liste) => {
        this.previsions.set(liste);
        this.chargement.set(false);
      },
      error: (e: Error) => {
        this.previsions.set([]);
        this.erreur.set(e.message);
        this.chargement.set(false);
      },
    });
  }

  /** Après une création : la nouvelle prévision (la plus récente) devient la prévision courante. */
  ajouter(prevision: Prevision): void {
    this.previsions.update((liste) => [prevision, ...liste]);
    this.previsionChoisie.set(prevision.previsionId);
  }

  remplacer(prevision: Prevision): void {
    this.previsions.update((liste) => liste.map((p) => (p.previsionId === prevision.previsionId ? prevision : p)));
  }
}

function projetInitial(): string {
  try {
    const memorise = localStorage.getItem(CLE_PROJET);
    if (memorise) return memorise;
  } catch {
    // Stockage indisponible : un projet éphémère est créé.
  }
  const nouveau = crypto.randomUUID();
  memoriser(nouveau);
  return nouveau;
}

function memoriser(projetId: string): void {
  try {
    localStorage.setItem(CLE_PROJET, projetId);
  } catch {
    // ignoré
  }
}
