import { Injectable, computed, inject, signal } from '@angular/core';

import { Prevision } from '../models/finance.models';
import { FinanceApiService } from './finance-api.service';

const CLE_PROJET = 'launchpad.finance.projetId';

/**
 * État partagé des écrans Finance : projet courant (identifiant entier) et ses prévisions.
 *
 * Le projet est un entier, comme dans les autres services (Market, AI, User).
 * En attendant le User-Service, il est conservé dans le navigateur ; un nouvel identifiant suffit pour
 * démarrer un projet vierge.
 */
@Injectable({ providedIn: 'root' })
export class FinanceStore {
  private readonly api = inject(FinanceApiService);

  readonly projetId = signal<number>(projetInitial());
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

  changerProjet(projetId: number): void {
    this.projetId.set(projetId);
    this.previsionChoisie.set(null);
    memoriser(projetId);
    this.recharger();
  }

  nouveauProjet(): void {
    this.changerProjet(nouvelIdentifiant());
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

function projetInitial(): number {
  try {
    const memorise = Number(localStorage.getItem(CLE_PROJET));
    if (Number.isSafeInteger(memorise) && memorise > 0) return memorise;
  } catch {
    // Stockage indisponible : un projet éphémère est créé.
  }
  const nouveau = nouvelIdentifiant();
  memoriser(nouveau);
  return nouveau;
}

/** Identifiant entier positif pour un projet vierge (le Finance-Service attend un BIGINT). */
function nouvelIdentifiant(): number {
  return Math.floor(Math.random() * 1_000_000_000) + 1;
}

function memoriser(projetId: number): void {
  try {
    localStorage.setItem(CLE_PROJET, String(projetId));
  } catch {
    // ignoré
  }
}
