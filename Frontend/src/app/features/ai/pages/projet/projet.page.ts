import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink } from '@angular/router';

import { environment } from '../../../../../environments/environment';
import { BadgeComponent } from '../../../../shared/components/badge.component';
import { EmptyStateComponent } from '../../../../shared/components/empty-state.component';
import { IconComponent } from '../../../../shared/components/icon.component';
import { LoaderComponent } from '../../../../shared/components/loader.component';
import { NotificationService } from '../../../../core/notifications/notification.service';
import { ProjetApiService } from '../../services/projet-api.service';
import { AnalyseProjet, Projet, ProjetSaisie, SecteurEtude, StadeProjet } from '../../models/ai.models';
import { STADES, STATUTS_PROJET } from '../../models/libelles';

/**
 * Page « Mon Projet & Diagnostic » (maquettes Co-Fondateur IA).
 * Affiche le projet courant, les boutons d'action (activer, analyser)
 * et les résultats du dernier diagnostic (score, forces, faiblesses).
 */
@Component({
  selector: 'app-projet',
  imports: [DatePipe, DecimalPipe, RouterLink, BadgeComponent, EmptyStateComponent, IconComponent, LoaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './projet.page.html',
  styleUrl: './projet.page.scss',
})
export class ProjetPage {
  private readonly api = inject(ProjetApiService);
  private readonly notifications = inject(NotificationService);

  protected readonly projetId = environment.utilisateur.projetId;
  protected readonly stades = Object.entries(STADES) as [StadeProjet, string][];
  protected readonly statutsProjet = STATUTS_PROJET;

  protected readonly projet = signal<Projet | null>(null);
  protected readonly analyse = signal<AnalyseProjet | null>(null);
  protected readonly chargement = signal(true);
  protected readonly erreur = signal<string | null>(null);
  protected readonly analyseEnCours = signal(false);
  protected readonly activationEnCours = signal(false);
  protected readonly modaleOuverte = signal(false);
  protected readonly saisie = signal<Partial<ProjetSaisie>>({});
  protected readonly enregistrementEnCours = signal(false);

  /** Secteurs proposés dans la modale : ceux des études de marché du projet. */
  protected readonly secteursEtudes = signal<SecteurEtude[]>([]);
  protected readonly chargementSecteurs = signal(false);
  protected readonly erreurSecteurs = signal<string | null>(null);

  protected readonly scoreLabel = computed(() => {
    const s = this.analyse()?.score_global;
    if (s === undefined || s === null) return '—';
    if (s >= 80) return 'Excellent';
    if (s >= 60) return 'Bien';
    if (s >= 40) return 'Moyen';
    return 'À améliorer';
  });

  protected readonly scoreCouleur = computed(() => {
    const s = this.analyse()?.score_global ?? 0;
    if (s >= 80) return '#24704c';
    if (s >= 60) return '#2b7a86';
    if (s >= 40) return '#9a5b07';
    return '#b23a3a';
  });

  protected readonly circumference = 2 * Math.PI * 42;

  protected readonly dashOffset = computed(() => {
    const s = this.analyse()?.score_global ?? 0;
    return this.circumference * (1 - s / 100);
  });

  protected readonly listeObjectifs = computed(() => {
    const obj = this.projet()?.objectifs;
    if (!obj) return [];
    const lignes = obj
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (lignes.length > 1) return lignes;
    return obj
      .split(/\.\s+/)
      .map((s) => s.trim().replace(/\.$/, ''))
      .filter(Boolean);
  });

  constructor() {
    this.charger();
  }

  protected charger(): void {
    this.chargement.set(true);
    this.erreur.set(null);
    this.api.lireProjet(this.projetId).subscribe({
      next: (projet) => {
        this.projet.set(projet);
        this.chargement.set(false);
        this.chargerDerniereAnalyse();
      },
      error: () => {
        this.erreur.set('Impossible de charger votre projet. Vérifiez que le service est démarré.');
        this.chargement.set(false);
      },
    });
  }

  private chargerDerniereAnalyse(): void {
    this.api.listerAnalyses().subscribe({
      next: (analyses) => {
        const triees = [...analyses]
          .filter((a) => a.projet_id === this.projetId)
          .sort((a, b) => b.date_creation.localeCompare(a.date_creation));
        this.analyse.set(triees[0] ?? null);
      },
      error: () => {
        // Non bloquant : la page reste utilisable sans analyse
      },
    });
  }

  protected activer(): void {
    const p = this.projet();
    if (!p) return;
    this.activationEnCours.set(true);
    this.api.activerProjet(p.id).subscribe({
      next: (mis_a_jour) => {
        this.projet.set(mis_a_jour);
        this.activationEnCours.set(false);
        this.notifications.succes('Projet activé avec succès.');
      },
      error: () => {
        this.activationEnCours.set(false);
        this.notifications.erreur("Impossible d'activer le projet.");
      },
    });
  }

  protected analyser(): void {
    const p = this.projet();
    if (!p) return;
    this.analyseEnCours.set(true);
    this.api.analyserProjet(p.id).subscribe({
      next: (analyse) => {
        this.analyse.set(analyse);
        this.analyseEnCours.set(false);
        this.notifications.succes('Diagnostic généré avec succès !');
      },
      error: () => {
        this.analyseEnCours.set(false);
        this.notifications.erreur('Impossible de générer le diagnostic.');
      },
    });
  }

  /** Ouvre la modale pré-remplie avec les valeurs actuelles du projet (stade, un objectif par ligne). */
  protected ouvrirModale(): void {
    const p = this.projet();
    if (!p) return;
    this.saisie.set({
      titre: p.titre,
      idee: p.idee,
      objectifs: this.listeObjectifs().join('\n'),
      secteur_id: p.secteur_id,
      stade: p.stade,
      public_cible: p.public_cible,
      budget_estime: p.budget_estime ?? undefined,
    });
    this.modaleOuverte.set(true);
    this.chargerSecteursEtudes(p.id);
  }

  private chargerSecteursEtudes(projetId: number): void {
    this.chargementSecteurs.set(true);
    this.erreurSecteurs.set(null);
    this.secteursEtudes.set([]);
    this.api.listerSecteursEtudes(projetId).subscribe({
      next: (secteurs) => {
        this.secteursEtudes.set(secteurs);
        this.chargementSecteurs.set(false);
      },
      error: () => {
        this.erreurSecteurs.set(
          "Impossible de charger les secteurs : le service Étude de marché est indisponible.",
        );
        this.chargementSecteurs.set(false);
      },
    });
  }

  protected fermerModale(): void {
    this.modaleOuverte.set(false);
  }

  /**
   * Envoie la saisie. Le nom du secteur n'est jamais envoyé : le Projet-Service le déduit
   * de secteur_id, qui n'est envoyé que s'il a changé (il est alors vérifié côté Étude de marché).
   */
  protected enregistrer(): void {
    const p = this.projet();
    if (!p || this.enregistrementEnCours()) return;
    const { secteur: _nomIgnore, secteur_id, ...reste } = this.saisie();
    const donnees: Partial<ProjetSaisie> = { ...reste };
    if (secteur_id != null && secteur_id !== p.secteur_id) donnees.secteur_id = secteur_id;

    this.enregistrementEnCours.set(true);
    this.api.modifierProjet(p.id, donnees).subscribe({
      next: (mis_a_jour) => {
        this.projet.set(mis_a_jour);
        this.enregistrementEnCours.set(false);
        this.fermerModale();
        this.notifications.succes('Projet mis à jour.');
      },
      error: (e: unknown) => {
        this.enregistrementEnCours.set(false);
        this.notifications.erreur(this.messageErreur(e));
      },
    });
  }

  /** Message renvoyé par le Projet-Service (400 secteur sans étude, 503 Étude de marché indisponible). */
  private messageErreur(e: unknown): string {
    const corps = e instanceof HttpErrorResponse ? e.error : null;
    const secteur = corps?.secteur_id;
    if (Array.isArray(secteur) && secteur.length) return String(secteur[0]);
    if (typeof corps?.detail === 'string') return corps.detail;
    return 'Impossible de mettre à jour le projet.';
  }

  protected choisirSecteur(valeur: string): void {
    this.mettreAJourSaisie('secteur_id', valeur ? Number(valeur) : null);
  }

  protected mettreAJourSaisie(champ: keyof ProjetSaisie, valeur: unknown): void {
    this.saisie.update((s) => ({ ...s, [champ]: valeur }));
  }

  protected stadeLibelle(stade: StadeProjet): string {
    return STADES[stade] ?? stade;
  }
}
