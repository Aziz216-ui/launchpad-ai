import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';

import { AuthService } from '../../../core/services/auth.service';
import {
  DroitsProjet,
  Prevision,
  ProjetAccessible,
  ProjetPlateforme,
  ProjetPlateformeSaisie,
} from '../models/finance.models';
import { FinanceApiService } from './finance-api.service';
import { ProjetsPlateformeService } from './projets-plateforme.service';

const CLE_PROJET = 'launchpad.finance.projetId';

/**
 * État partagé des écrans Finance : projet courant, droits de l'utilisateur sur ce projet, prévisions du projet
 * et projets accessibles.
 *
 * - L'entrepreneur choisit l'un de SES projets de la plateforme (Projet-Service), par son titre ; il en devient
 *   propriétaire côté Finance en y créant la première prévision. « Nouveau projet » crée un vrai projet de la
 *   plateforme, visible aussi par les autres modules.
 * - Le financier ne voit que les projets où un entrepreneur l'a invité (« mes projets »).
 * Les droits (écriture, validation) viennent du backend, qui reste seul juge : l'interface ne fait que masquer
 * les actions interdites.
 *
 * projetId vaut 0 tant qu'aucun projet n'est choisi : les écrans ne s'affichent alors pas.
 */
@Injectable({ providedIn: 'root' })
export class FinanceStore {
  private readonly api = inject(FinanceApiService);
  private readonly plateforme = inject(ProjetsPlateformeService);
  private readonly auth = inject(AuthService);

  readonly projetId = signal<number>(0);
  readonly previsions = signal<Prevision[]>([]);
  readonly chargement = signal(false);
  readonly erreur = signal<string | null>(null);

  readonly droits = signal<DroitsProjet | null>(null);
  /** Propriétaire (ou admin) : saisir, générer, supprimer, inviter. */
  readonly peutEcrire = computed(() => this.droits()?.ecriture ?? false);
  /** Financier invité (ou admin) : valider les prévisions, certifier les documents. */
  readonly peutValider = computed(() => this.droits()?.validation ?? false);

  /** Entrepreneur : ses projets de la plateforme. */
  readonly projets = signal<ProjetPlateforme[]>([]);
  /** Entrepreneur sans aucun projet : il doit en créer un. */
  readonly aucunProjet = signal(false);
  /** Financier : projets où il est invité. */
  readonly mesProjets = signal<ProjetAccessible[]>([]);
  /** Financier sans aucun projet confié : rien à afficher. */
  readonly aucunProjetConfie = signal(false);
  /** Titres des projets suivis par le financier (les siens ne sont pas listés par le Projet-Service). */
  private readonly titresSuivis = signal<Record<number, string>>({});

  /** Titre affiché d'un projet ; à défaut « Projet n° X ». */
  readonly titre = (projetId: number): string =>
    this.projets().find((p) => p.id === projetId)?.titre ?? this.titresSuivis()[projetId] ?? `Projet n° ${projetId}`;

  /**
   * Libellé d'un projet dans la liste : « titre · secteur ». Si plusieurs projets portent le même titre, la date de
   * création les distingue (l'identifiant technique n'est jamais montré).
   */
  libelleProjet(projet: ProjetPlateforme): string {
    const homonyme = this.projets().some((p) => p.id !== projet.id && p.titre === projet.titre);
    const date = homonyme && projet.date_creation
      ? ' · créé le ' + new Date(projet.date_creation).toLocaleString('fr-FR', {
          day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
        })
      : '';
    return projet.titre + (projet.secteur ? ' · ' + projet.secteur : '') + date;
  }

  /** Prévision sélectionnée ; à défaut, la plus récente (le backend trie du plus récent au plus ancien). */
  private readonly previsionChoisie = signal<string | null>(null);
  readonly prevision = computed<Prevision | null>(() => {
    const liste = this.previsions();
    return liste.find((p) => p.previsionId === this.previsionChoisie()) ?? liste[0] ?? null;
  });

  /** Rôle plateforme FINANCIER : l'écran Finance devient un espace de relecture des projets confiés. */
  estFinancier(): boolean {
    return this.auth.currentUserValue?.role === 'FINANCIER';
  }

  /**
   * Premier chargement du module : le financier est placé sur l'un de ses projets confiés, l'entrepreneur sur le
   * dernier projet qu'il avait ouvert (ou le plus récent).
   */
  demarrer(): void {
    if (this.estFinancier()) {
      this.demarrerFinancier();
    } else {
      this.demarrerEntrepreneur();
    }
  }

  private demarrerEntrepreneur(): void {
    const entrepreneurId = this.auth.currentUserValue?.id;
    if (!entrepreneurId) {
      this.erreur.set('Utilisateur inconnu : reconnectez-vous.');
      return;
    }
    this.chargement.set(true);
    this.plateforme.listerDe(entrepreneurId).subscribe({
      next: (liste) => {
        this.projets.set(liste);
        this.aucunProjet.set(liste.length === 0);
        if (liste.length === 0) {
          this.vider();
          return;
        }
        const memorise = projetMemorise();
        this.changerProjet(liste.some((p) => p.id === memorise) ? memorise! : liste[0].id);
      },
      error: (e: Error) => {
        this.erreur.set(`Impossible de charger vos projets : ${e.message}`);
        this.chargement.set(false);
      },
    });
  }

  private demarrerFinancier(): void {
    this.chargement.set(true);
    this.api.mesProjets().subscribe({
      next: (liste) => {
        this.mesProjets.set(liste);
        this.aucunProjetConfie.set(liste.length === 0);
        this.chargerTitresSuivis(liste);
        if (liste.length === 0) {
          this.vider();
          return;
        }
        const memorise = projetMemorise();
        this.changerProjet(liste.some((p) => p.projetId === memorise) ? memorise! : liste[0].projetId);
      },
      error: (e: Error) => {
        this.erreur.set(e.message);
        this.chargement.set(false);
      },
    });
  }

  /** Crée un projet de la plateforme pour l'entrepreneur connecté, puis l'ouvre. */
  creerProjet(saisie: ProjetPlateformeSaisie): Observable<ProjetPlateforme> {
    const entrepreneurId = this.auth.currentUserValue?.id ?? 0;
    return this.plateforme.creer(entrepreneurId, saisie).pipe(
      tap((projet) => {
        this.projets.update((liste) => [projet, ...liste]);
        this.aucunProjet.set(false);
        this.changerProjet(projet.id);
      }),
    );
  }

  choisirPrevision(previsionId: string): void {
    this.previsionChoisie.set(previsionId);
  }

  changerProjet(projetId: number): void {
    this.projetId.set(projetId);
    this.previsionChoisie.set(null);
    memoriser(projetId);
    this.recharger();
  }

  recharger(): void {
    const projetId = this.projetId();
    if (!projetId) return;
    this.chargement.set(true);
    this.erreur.set(null);
    this.droits.set(null);
    this.rechargerDroits();
    this.api.listerPrevisions(projetId).subscribe({
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

  rechargerDroits(): void {
    const projetId = this.projetId();
    if (!projetId) return;
    this.api.droits(projetId).subscribe({
      next: (droits) => {
        if (droits.projetId === this.projetId()) this.droits.set(droits);
      },
      error: () => this.droits.set(null),
    });
  }

  /** Met à jour la liste des projets suivis (et le nombre de prévisions à valider), sans changer de projet. */
  rafraichirMesProjets(): void {
    if (!this.estFinancier()) return;
    this.api.mesProjets().subscribe({
      next: (liste) => {
        this.mesProjets.set(liste);
        this.aucunProjetConfie.set(liste.length === 0);
        this.chargerTitresSuivis(liste);
      },
      error: () => undefined,
    });
  }

  /** Après une création : la nouvelle prévision (la plus récente) devient la prévision courante. */
  ajouter(prevision: Prevision): void {
    this.previsions.update((liste) => [prevision, ...liste]);
    this.previsionChoisie.set(prevision.previsionId);
    // La première prévision d'un projet libre en fait le propriétaire : les droits changent.
    if (this.droits()?.role === 'AUCUN') this.rechargerDroits();
  }

  remplacer(prevision: Prevision): void {
    this.previsions.update((liste) => liste.map((p) => (p.previsionId === prevision.previsionId ? prevision : p)));
  }

  private vider(): void {
    this.projetId.set(0);
    this.previsions.set([]);
    this.droits.set(null);
    this.chargement.set(false);
  }

  private chargerTitresSuivis(liste: ProjetAccessible[]): void {
    for (const { projetId } of liste) {
      if (this.titresSuivis()[projetId]) continue;
      this.plateforme.lire(projetId).subscribe({
        next: (p) => this.titresSuivis.update((titres) => ({ ...titres, [projetId]: p.titre })),
        error: () => undefined,
      });
    }
  }
}

function projetMemorise(): number | null {
  try {
    const memorise = Number(localStorage.getItem(CLE_PROJET));
    return Number.isSafeInteger(memorise) && memorise > 0 ? memorise : null;
  } catch {
    return null;
  }
}

function memoriser(projetId: number): void {
  try {
    localStorage.setItem(CLE_PROJET, String(projetId));
  } catch {
    // ignoré
  }
}
