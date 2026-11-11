import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';

import { ApiError } from '../../../../core/http/api-error';
import { NotificationService } from '../../../../core/notifications/notification.service';
import { BadgeComponent } from '../../../../shared/components/badge.component';
import { LoaderComponent } from '../../../../shared/components/loader.component';
import { SaisieModalComponent } from '../../../../shared/components/saisie-modal.component';
import {
  DemandeRevue,
  DocumentJuridiqueDetail,
  STATUTS_DEMANDE,
  STATUTS_JURIDIQUES,
  StatutDemande,
  TYPES_JURIDIQUES,
  idDocument,
  libelleStatutDemande,
} from '../../models/avocat.models';
import { AvocatApiService } from '../../services/avocat-api.service';

type Decision = 'refuser' | 'approuver' | 'corrections' | 'rejeter';

const DECISIONS: Record<Decision, { statut: StatutDemande; titre: string; texte: string; champ: string; obligatoire: boolean; confirmer: string; variante: 'primaire' | 'danger'; succes: string }> = {
  refuser: { statut: 'REJECTED', titre: 'Refuser la demande', texte: "L'entrepreneur verra ce motif et pourra s'adresser à un autre avocat.", champ: 'Motif du refus', obligatoire: true, confirmer: 'Refuser', variante: 'danger', succes: 'Demande refusée.' },
  approuver: { statut: 'APPROVED', titre: 'Approuver le document', texte: 'Votre avis final : le document est conforme.', champ: 'Commentaire (facultatif)', obligatoire: false, confirmer: 'Approuver', variante: 'primaire', succes: 'Document approuvé.' },
  corrections: { statut: 'NEEDS_CORRECTION', titre: 'Demander des corrections', texte: "L'entrepreneur sera invité à corriger son document ; la revue reste ouverte.", champ: 'Corrections attendues', obligatoire: true, confirmer: 'Demander les corrections', variante: 'primaire', succes: 'Corrections demandées.' },
  rejeter: { statut: 'REJECTED', titre: 'Rejeter le document', texte: 'Votre avis final : le document ne peut pas être utilisé en l\'état.', champ: 'Motif du rejet', obligatoire: true, confirmer: 'Rejeter', variante: 'danger', succes: 'Document rejeté.' },
};

/**
 * Demande de revue d'un document (Lawyer-DocReview-Service), pour les deux rôles :
 *  - avocat : accepter / refuser, lire le document, laisser son avis (commentaires, correction demandée)
 *    et sa décision (approuvé, corrections demandées, rejeté) ;
 *  - entrepreneur : suivre la demande, lire l'avis et répondre.
 * Côté entrepreneur, l'avocat concerné est passé dans l'URL (?avocat=) : les services avocat l'exigent.
 */
@Component({
  selector: 'app-demande-avocat',
  imports: [DatePipe, FormsModule, RouterLink, BadgeComponent, LoaderComponent, SaisieModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './demande.page.html',
  styleUrl: './demande.page.scss',
})
export class DemandePage implements OnInit {
  private readonly api = inject(AvocatApiService);
  private readonly notifications = inject(NotificationService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly estAvocat = this.api.utilisateur()?.role === 'LAWYER';
  protected readonly statutsDemande = STATUTS_DEMANDE;
  protected readonly statutsJuridiques = STATUTS_JURIDIQUES;
  protected readonly typesJuridiques = TYPES_JURIDIQUES;
  protected readonly libelleStatutDemande = libelleStatutDemande;

  private id = 0;
  private avocat: string | undefined;
  protected readonly demande = signal<DemandeRevue | null>(null);
  protected readonly document = signal<DocumentJuridiqueDetail | null>(null);
  protected readonly erreurDocument = signal(false);
  protected readonly chargement = signal(true);
  protected readonly erreur = signal<string | null>(null);

  protected commentaire = '';
  protected correction = false;
  protected readonly envoiCommentaire = signal(false);
  protected readonly erreurCommentaire = signal<string | null>(null);

  protected readonly decision = signal<Decision | null>(null);
  protected readonly decisionEnCours = signal(false);
  protected readonly erreurDecision = signal<string | null>(null);
  protected readonly textesDecision = computed(() => {
    const d = this.decision();
    return d ? DECISIONS[d] : null;
  });

  protected readonly enRevue = computed(() => ['IN_PROGRESS', 'NEEDS_CORRECTION'].includes(this.demande()?.status ?? ''));
  protected readonly terminee = computed(() => ['APPROVED', 'REJECTED'].includes(this.demande()?.status ?? ''));
  /** Commentaires du plus ancien au plus récent : la question de l'entrepreneur en premier. */
  protected readonly commentaires = computed(() => [...(this.demande()?.comments ?? [])].sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
  protected readonly historique = computed(() => [...(this.demande()?.history ?? [])].sort((a, b) => b.timestamp.localeCompare(a.timestamp)));
  protected readonly derniereRaison = computed(() => {
    const d = this.demande();
    if (!d || d.status === 'PENDING' || d.status === 'IN_PROGRESS') return null;
    return [...d.history].reverse().find((h) => h.newStatus === d.status)?.reason ?? null;
  });
  protected readonly idDoc = computed(() => {
    const d = this.demande();
    return d ? idDocument(d) : null;
  });

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((p) => {
      this.id = Number(p.get('id'));
      this.avocat = this.estAvocat ? undefined : (this.route.snapshot.queryParamMap.get('avocat') ?? undefined);
      this.charger();
    });
  }

  protected retour(): string[] {
    return ['/professional/avocat'];
  }

  protected charger(silencieux = false): void {
    if (!silencieux) this.chargement.set(true);
    this.erreur.set(null);
    if (!this.estAvocat && !this.avocat) {
      this.erreur.set("Avocat non précisé : ouvrez la demande depuis l'onglet « Demande revue ».");
      this.chargement.set(false);
      return;
    }
    this.api.demande(this.id, this.avocat).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (d) => {
        this.demande.set(d);
        this.chargement.set(false);
        const docId = idDocument(d);
        if (docId && !this.document()) {
          this.api.documentJuridique(docId).pipe(catchError(() => of(null))).subscribe((doc) => {
            this.document.set(doc);
            this.erreurDocument.set(!doc);
          });
        }
      },
      error: (e: unknown) => {
        this.erreur.set(e instanceof ApiError && e.statut === 404 ? 'Cette demande est introuvable.' : 'Impossible de charger la demande.');
        this.chargement.set(false);
      },
    });
  }

  // --- Avocat : accepter puis décider ---------------------------------------------------------

  protected accepter(): void {
    this.decisionEnCours.set(true);
    this.api.decider(this.id, 'IN_PROGRESS', 'Demande acceptée').subscribe({
      next: (d) => {
        this.decisionEnCours.set(false);
        this.demande.set(d);
        this.notifications.succes('Demande acceptée : vous pouvez revoir le document.');
      },
      error: (e: unknown) => {
        this.decisionEnCours.set(false);
        this.notifications.erreur(e instanceof ApiError ? e.message : "L'acceptation a échoué.");
      },
    });
  }

  protected ouvrirDecision(d: Decision): void {
    this.erreurDecision.set(null);
    this.decision.set(d);
  }

  protected confirmerDecision(raison: string): void {
    const d = this.decision();
    if (!d) return;
    const def = DECISIONS[d];
    this.decisionEnCours.set(true);
    this.erreurDecision.set(null);
    this.api.decider(this.id, def.statut, raison || def.titre).subscribe({
      next: (maj) => {
        this.decisionEnCours.set(false);
        this.decision.set(null);
        this.demande.set(maj);
        this.notifications.succes(def.succes);
      },
      error: (e: unknown) => {
        this.decisionEnCours.set(false);
        this.erreurDecision.set(e instanceof ApiError ? e.message : 'La décision a échoué.');
      },
    });
  }

  // --- Avis et réponses -------------------------------------------------------------------------

  protected envoyerCommentaire(): void {
    const texte = this.commentaire.trim();
    if (!texte || this.envoiCommentaire()) return;
    const auteur = this.estAvocat ? `Me ${this.api.nomUtilisateur()}` : `${this.api.nomUtilisateur()} (entrepreneur)`;
    this.envoiCommentaire.set(true);
    this.erreurCommentaire.set(null);
    this.api.commenter(this.avocat, this.id, auteur, texte, this.estAvocat && this.correction).subscribe({
      next: (d) => {
        this.envoiCommentaire.set(false);
        this.demande.set(d);
        this.commentaire = '';
        this.correction = false;
      },
      error: (e: unknown) => {
        this.envoiCommentaire.set(false);
        this.erreurCommentaire.set(e instanceof ApiError ? e.message : "Le commentaire n'a pas pu être envoyé.");
      },
    });
  }

  protected estDeLAvocat(auteur: string): boolean {
    return auteur.startsWith('Me ') || auteur.startsWith('Maître');
  }

  protected libelleStatut(s: StatutDemande | null): string {
    return s ? STATUTS_DEMANDE[s].libelle : 'Création';
  }

  protected ouvrirDocument(): void {
    const id = this.idDoc();
    if (!id) return;
    this.router.navigate(this.estAvocat ? ['/juridique/revue', id] : ['/juridique/documents', id]);
  }
}
