import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Observable, catchError, of } from 'rxjs';

import { ApiError } from '../../../../core/http/api-error';
import { NotificationService } from '../../../../core/notifications/notification.service';
import { AuthService } from '../../../../core/services/auth.service';
import { BadgeComponent } from '../../../../shared/components/badge.component';
import { LoaderComponent } from '../../../../shared/components/loader.component';
import { SaisieModalComponent } from '../../../../shared/components/saisie-modal.component';
import { ClausesComponent } from '../../components/clauses.component';
import { CommentairesComponent } from '../../components/commentaires.component';
import {
  DocumentDetail,
  StatutDocumentJuridique,
  StatutSignature,
  libelleParametre,
  libelleStatut,
  libelleType,
  varianteStatut,
} from '../../models/legal.models';
import { LegalApiService, telechargerBlob } from '../../services/legal-api.service';

type Action = 'envoyer' | 'signatures' | 'archiver' | 'supprimer';

const ETAPES: { statut: StatutDocumentJuridique; libelle: string }[] = [
  { statut: 'BROUILLON', libelle: 'Brouillon' },
  { statut: 'EN_VALIDATION', libelle: 'Revue avocat' },
  { statut: 'VALIDE', libelle: 'Validé' },
  { statut: 'SIGNE', libelle: 'Signé' },
];
const COURRIEL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Document juridique côté entrepreneur : consultation (lecture seule : les modifications du titre et des
 * clauses sont faites par l'avocat pendant sa revue), envoi à un avocat, suivi de la revue (notes, questions, motif de refus), demande de signatures,
 * export PDF, archivage et suppression (ADMIN, la Gateway réservant DELETE à ce rôle).
 */
@Component({
  selector: 'app-document-juridique',
  imports: [DatePipe, RouterLink, BadgeComponent, LoaderComponent, SaisieModalComponent, ClausesComponent, CommentairesComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './document.page.html',
  styleUrl: './document.page.scss',
})
export class DocumentPage implements OnInit {
  private readonly api = inject(LegalApiService);
  private readonly notifications = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly utilisateur = inject(AuthService).currentUserValue;
  private readonly commentairesComposant = viewChild(CommentairesComponent);

  protected readonly estAdmin = this.utilisateur?.role === 'ADMIN';
  protected readonly etapes = ETAPES;
  protected readonly libelleType = libelleType;
  protected readonly libelleStatut = libelleStatut;
  protected readonly varianteStatut = varianteStatut;
  protected readonly libelleParametre = libelleParametre;

  private id = '';
  protected readonly document = signal<DocumentDetail | null>(null);
  protected readonly signatures = signal<StatutSignature | null>(null);
  protected readonly chargement = signal(true);
  protected readonly erreur = signal<string | null>(null);

  protected readonly envoiReponse = signal(false);
  protected readonly erreurReponse = signal<string | null>(null);
  protected readonly telechargement = signal(false);

  protected readonly action = signal<Action | null>(null);
  protected readonly actionEnCours = signal(false);
  protected readonly erreurAction = signal<string | null>(null);

  /** Index de l'étape courante dans le suivi (le refus remplace l'étape « Validé »). */
  protected readonly etapeCourante = computed(() => {
    const s = this.document()?.statut;
    return s === 'REFUSE' ? 2 : ETAPES.findIndex((e) => e.statut === s);
  });
  protected readonly parametres = computed(() =>
    Object.entries(this.document()?.metadata ?? {})
      .filter(([, v]) => v !== null && v !== undefined && v !== '')
      .map(([cle, v]) => ({ cle, libelle: libelleParametre(cle, this.document()?.type), valeur: Array.isArray(v) ? v.join(', ') : String(v) })),
  );
  protected readonly peutSupprimer = computed(() => {
    const d = this.document();
    return this.estAdmin && !!d && d.statut !== 'SIGNE' && !d.isArchived;
  });
  protected readonly textesAction = computed(() => {
    const d = this.document();
    switch (this.action()) {
      case 'envoyer':
        return { titre: 'Envoyer à un avocat', texte: "Le document passera « En validation » : vous ne pourrez plus le modifier pendant la revue. L'avocat pourra corriger des clauses, vous poser des questions, puis le valider ou le refuser.", champ: '', obligatoire: false, confirmer: 'Envoyer', variante: 'primaire' as const, placeholder: '' };
      case 'signatures':
        return { titre: 'Demander les signatures', texte: 'Indiquez les adresses e-mail des signataires (associés, client, partie réceptrice…).', champ: 'Signataires (un e-mail par ligne)', obligatoire: true, confirmer: 'Envoyer la demande', variante: 'primaire' as const, placeholder: 'alice@startup.io\nbob@partenaire.fr' };
      case 'archiver':
        return { titre: `Archiver « ${d?.titre ?? ''} » ?`, texte: 'Le document deviendra définitivement consultable en lecture seule : plus aucune modification ni changement de statut.', champ: '', obligatoire: false, confirmer: 'Archiver', variante: 'danger' as const, placeholder: '' };
      case 'supprimer':
        return { titre: `Supprimer « ${d?.titre ?? ''} » ?`, texte: 'Le document, ses clauses et ses commentaires seront supprimés définitivement.', champ: '', obligatoire: false, confirmer: 'Supprimer', variante: 'danger' as const, placeholder: '' };
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
      .document(this.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (d) => {
          this.document.set(d);
          this.chargement.set(false);
          if (d.statut === 'VALIDE' || d.statut === 'SIGNE' || d.signataires?.length) {
            this.api.statutSignatures(d.id).pipe(catchError(() => of(null))).subscribe((s) => this.signatures.set(s));
          } else {
            this.signatures.set(null);
          }
        },
        error: (e: unknown) => {
          this.erreur.set(
            e instanceof ApiError && (e.statut === 404 || e.statut === 400) ? 'Ce document est introuvable.' : 'Impossible de charger le document.',
          );
          this.chargement.set(false);
        },
      });
  }

  // --- Revue : réponse à l'avocat -------------------------------------------------------------

  protected repondre(texte: string): void {
    this.envoiReponse.set(true);
    this.erreurReponse.set(null);
    this.api.ajouterCommentaire(this.id, texte, `${this.nomUtilisateur()} (entrepreneur)`).subscribe({
      next: () => {
        this.envoiReponse.set(false);
        this.commentairesComposant()?.vider();
        this.charger(true);
      },
      error: (e: unknown) => {
        this.envoiReponse.set(false);
        this.erreurReponse.set(e instanceof ApiError ? e.message : "La réponse n'a pas pu être envoyée.");
      },
    });
  }

  // --- Actions --------------------------------------------------------------------------------

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
      case 'envoyer':
        appel = this.api.envoyerEnValidation(d.id, this.utilisateur?.username ?? 'entrepreneur');
        succes = 'Document envoyé en validation à un avocat.';
        break;
      case 'signatures': {
        const emails = [...new Set(saisie.split(/[\n,;]+/).map((e) => e.trim().toLowerCase()).filter(Boolean))];
        const invalides = emails.filter((e) => !COURRIEL.test(e));
        if (!emails.length || invalides.length) {
          this.erreurAction.set(invalides.length ? `Adresse(s) invalide(s) : ${invalides.join(', ')}` : 'Indiquez au moins un signataire.');
          return;
        }
        appel = this.api.demanderSignatures(d.id, emails);
        succes = `Demande de signature envoyée à ${emails.length} signataire(s).`;
        break;
      }
      case 'archiver':
        appel = this.api.archiver(d.id);
        succes = 'Document archivé : il est désormais en lecture seule.';
        break;
      case 'supprimer':
        appel = this.api.supprimer(d.id);
        succes = 'Document supprimé.';
        break;
    }

    this.actionEnCours.set(true);
    this.erreurAction.set(null);
    appel.subscribe({
      next: () => {
        this.actionEnCours.set(false);
        this.action.set(null);
        this.notifications.succes(succes);
        if (a === 'supprimer') {
          this.router.navigateByUrl('/juridique');
        } else {
          this.charger(true);
        }
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

  private nomUtilisateur(): string {
    const u = this.utilisateur;
    return `${u?.first_name ?? ''} ${u?.last_name ?? ''}`.trim() || u?.username || 'Entrepreneur';
  }
}
