import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Observable } from 'rxjs';

import { ApiError } from '../../../../core/http/api-error';
import { NotificationService } from '../../../../core/notifications/notification.service';
import { AuthService } from '../../../../core/services/auth.service';
import { BadgeComponent } from '../../../../shared/components/badge.component';
import { LoaderComponent } from '../../../../shared/components/loader.component';
import { SaisieModalComponent } from '../../../../shared/components/saisie-modal.component';
import { ClausesComponent, ModificationClause } from '../../components/clauses.component';
import { CommentairesComponent } from '../../components/commentaires.component';
import { DocumentDetail, libelleParametre, libelleStatut, libelleType, varianteStatut } from '../../models/legal.models';
import { LegalApiService, telechargerBlob } from '../../services/legal-api.service';

type Action = 'question' | 'accepter' | 'refuser' | 'signer';

/**
 * Revue d'un document par l'avocat (GET /verification/documents/{id}) : seul l'avocat modifie le
 * document (titre, titres et textes des clauses) pendant la revue ;
 * notes juridiques, demandes d'informations, décision (accepter / refuser avec motif), signature, PDF.
 */
@Component({
  selector: 'app-revue-document',
  imports: [DatePipe, FormsModule, RouterLink, BadgeComponent, LoaderComponent, SaisieModalComponent, ClausesComponent, CommentairesComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './revue-document.page.html',
  styleUrl: './revue-document.page.scss',
})
export class RevueDocumentPage implements OnInit {
  private readonly api = inject(LegalApiService);
  private readonly notifications = inject(NotificationService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly utilisateur = inject(AuthService).currentUserValue;
  private readonly clausesComposant = viewChild(ClausesComponent);
  private readonly commentairesComposant = viewChild(CommentairesComponent);

  protected readonly libelleType = libelleType;
  protected readonly libelleStatut = libelleStatut;
  protected readonly varianteStatut = varianteStatut;
  /** Nom affiché comme auteur des notes, questions et signature. */
  protected readonly avocat = (() => {
    const nom = `${this.utilisateur?.first_name ?? ''} ${this.utilisateur?.last_name ?? ''}`.trim() || this.utilisateur?.username || 'Avocat';
    return `Me ${nom}`;
  })();

  private id = '';
  protected readonly document = signal<DocumentDetail | null>(null);
  protected readonly chargement = signal(true);
  protected readonly erreur = signal<string | null>(null);
  protected readonly editionTitre = signal(false);
  protected titre = '';
  protected readonly enregistrementTitre = signal(false);
  protected readonly enregistrementClause = signal(false);
  protected readonly erreurClause = signal<string | null>(null);
  protected readonly envoiNote = signal(false);
  protected readonly erreurNote = signal<string | null>(null);
  protected readonly telechargement = signal(false);
  protected readonly action = signal<Action | null>(null);
  protected readonly actionEnCours = signal(false);
  protected readonly erreurAction = signal<string | null>(null);

  protected readonly enRevue = computed(() => {
    const d = this.document();
    return !!d && d.statut === 'EN_VALIDATION' && !d.isArchived;
  });
  protected readonly parametres = computed(() =>
    Object.entries(this.document()?.metadata ?? {})
      .filter(([, v]) => v !== null && v !== undefined && v !== '')
      .map(([cle, v]) => ({ cle, libelle: libelleParametre(cle, this.document()?.type), valeur: Array.isArray(v) ? v.join(', ') : String(v) })),
  );
  protected readonly textesAction = computed(() => {
    const d = this.document();
    switch (this.action()) {
      case 'question':
        return { titre: "Demander des informations à l'entrepreneur", texte: 'La question est ajoutée aux notes du document ; l\'entrepreneur la voit et peut y répondre.', champ: 'Votre question', obligatoire: true, confirmer: 'Envoyer la question', variante: 'primaire' as const };
      case 'accepter':
        return { titre: `Valider « ${d?.titre ?? ''} » ?`, texte: "Le document passera « Validé » : l'entrepreneur pourra demander les signatures. Le PDF portera la mention « validé par un avocat ».", champ: '', obligatoire: false, confirmer: 'Valider le document', variante: 'primaire' as const };
      case 'refuser':
        return { titre: `Refuser « ${d?.titre ?? ''} »`, texte: "L'entrepreneur verra ce motif.", champ: 'Motif du refus', obligatoire: true, confirmer: 'Refuser', variante: 'danger' as const };
      case 'signer':
        return { titre: `Signer « ${d?.titre ?? ''} » ?`, texte: `Le document passera « Signé » au nom de ${this.avocat}. Cette action est définitive.`, champ: '', obligatoire: false, confirmer: 'Signer', variante: 'primaire' as const };
      default:
        return null;
    }
  });

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((p) => {
      this.id = p.get('id') ?? '';
      this.charger();
    });
  }

  protected charger(silencieux = false): void {
    if (!silencieux) this.chargement.set(true);
    this.erreur.set(null);
    this.api
      .documentEnRevue(this.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (d) => {
          this.document.set(d);
          this.chargement.set(false);
        },
        error: (e: unknown) => {
          this.erreur.set(e instanceof ApiError && (e.statut === 404 || e.statut === 400) ? 'Ce document est introuvable.' : 'Impossible de charger le document.');
          this.chargement.set(false);
        },
      });
  }

  protected ouvrirTitre(): void {
    this.titre = this.document()?.titre ?? '';
    this.editionTitre.set(true);
  }

  /** Renommage pendant la revue (PATCH /documents/{id}), réservé à l'avocat dans l'interface. */
  protected enregistrerTitre(): void {
    const titre = this.titre.trim();
    const d = this.document();
    if (!d || !titre || titre === d.titre) {
      this.editionTitre.set(false);
      return;
    }
    this.enregistrementTitre.set(true);
    this.api.modifier(d.id, { titre }).subscribe({
      next: () => {
        this.enregistrementTitre.set(false);
        this.editionTitre.set(false);
        this.notifications.succes('Titre du document mis à jour.');
        this.charger(true);
      },
      error: (e: unknown) => {
        this.enregistrementTitre.set(false);
        this.notifications.erreur(e instanceof ApiError ? e.message : "Le titre n'a pas pu être modifié.");
      },
    });
  }

  /**
   * Correction d'une clause : le texte seul passe par la route de vérification
   * (PATCH /verification/documents/{id}/clauses/{numero}) ; un changement de titre de clause, que
   * cette route ne prend pas, passe par PATCH /documents/{id}/clauses/{numero}.
   */
  protected corrigerClause(m: ModificationClause): void {
    const avant = this.document()?.clauses.find((c) => c.numero === m.numero);
    const titreChange = (m.titre ?? '') !== (avant?.titre ?? '');
    this.enregistrementClause.set(true);
    this.erreurClause.set(null);
    const appel = titreChange && m.titre
      ? this.api.modifierClause(this.id, m.numero, m.texte, m.titre)
      : this.api.corrigerClause(this.id, m.numero, m.texte);
    appel.subscribe({
      next: () => {
        this.enregistrementClause.set(false);
        this.clausesComposant()?.fermer();
        this.notifications.succes(`Article ${m.numero} corrigé.`);
        this.charger(true);
      },
      error: (e: unknown) => {
        this.enregistrementClause.set(false);
        this.erreurClause.set(e instanceof ApiError ? e.message : "La correction n'a pas pu être enregistrée.");
      },
    });
  }

  protected ajouterNote(texte: string): void {
    this.envoiNote.set(true);
    this.erreurNote.set(null);
    this.api.ajouterCommentaire(this.id, texte, this.avocat).subscribe({
      next: () => {
        this.envoiNote.set(false);
        this.commentairesComposant()?.vider();
        this.charger(true);
      },
      error: (e: unknown) => {
        this.envoiNote.set(false);
        this.erreurNote.set(e instanceof ApiError ? e.message : "La note n'a pas pu être ajoutée.");
      },
    });
  }

  protected ouvrirAction(a: Action): void {
    this.erreurAction.set(null);
    this.action.set(a);
  }

  protected confirmerAction(saisie: string): void {
    const a = this.action();
    const d = this.document();
    if (!a || !d) return;
    let appel: Observable<unknown>;
    let succes: string;
    switch (a) {
      case 'question':
        appel = this.api.demanderInformations(d.id, saisie, this.avocat);
        succes = "Question envoyée à l'entrepreneur.";
        break;
      case 'accepter':
        appel = this.api.accepter(d.id);
        succes = 'Document validé.';
        break;
      case 'refuser':
        appel = this.api.refuser(d.id, saisie);
        succes = 'Document refusé.';
        break;
      case 'signer':
        appel = this.api.signer(d.id, this.avocat);
        succes = 'Document signé.';
        break;
    }
    this.actionEnCours.set(true);
    this.erreurAction.set(null);
    appel.subscribe({
      next: () => {
        this.actionEnCours.set(false);
        this.action.set(null);
        this.notifications.succes(succes);
        this.charger(true);
      },
      error: (e: unknown) => {
        this.actionEnCours.set(false);
        this.erreurAction.set(e instanceof ApiError ? e.message : "L'action a échoué.");
      },
    });
  }

  protected telechargerPdf(): void {
    const d = this.document();
    if (!d || this.telechargement()) return;
    this.telechargement.set(true);
    this.api.exporterPdf(d.id).subscribe({
      next: (blob) => {
        this.telechargement.set(false);
        telechargerBlob(blob, `${d.titre.replace(/[\\/:*?"<>|]+/g, '-')}.pdf`);
      },
      error: (e: unknown) => {
        this.telechargement.set(false);
        this.notifications.erreur(e instanceof ApiError ? e.message : "L'export PDF a échoué.");
      },
    });
  }
}
