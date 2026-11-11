import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Observable, catchError, forkJoin, of } from 'rxjs';

import { ApiError } from '../../../../core/http/api-error';
import { CentreNotificationsService } from '../../../../core/notifications/centre-notifications.service';
import { NotificationService } from '../../../../core/notifications/notification.service';
import { AuthService } from '../../../../core/services/auth.service';
import { BadgeComponent, VarianteBadge } from '../../../../shared/components/badge.component';
import { LoaderComponent } from '../../../../shared/components/loader.component';
import { DepotDocumentModalComponent } from '../../components/depot-document-modal.component';
import { HistoriqueDocumentModalComponent } from '../../components/historique-document-modal.component';
import { SaisieModalComponent } from '../../../../shared/components/saisie-modal.component';
import {
  AffectationDossier,
  DocumentComptable,
  DossierComptable,
  MessageDossier,
  STATUTS_DOCUMENT,
  STATUTS_DOSSIER,
  StatutDocument,
  StatutDossier,
  TYPES_DOCUMENT,
} from '../../models/comptabilite.models';
import { ComptabiliteApiService } from '../../services/comptabilite-api.service';

type Onglet = 'documents' | 'messages';

/** DELETE réservé à ADMIN par la Gateway ; passer à true si la règle est assouplie pour les documents. */
const SUPPRESSION_AUTORISEE = false;

/** Action en attente de confirmation dans la fenêtre de saisie. */
type Action =
  | { type: 'rejeter'; document: DocumentComptable }
  | { type: 'reviser'; document: DocumentComptable }
  | { type: 'supprimer'; document: DocumentComptable }
  | { type: 'refuser' }
  | { type: 'cloturer' };

const VARIANTES_DOSSIER: Record<StatutDossier, VarianteBadge> = {
  PENDING: 'attention',
  ACTIVE: 'succes',
  REJECTED: 'danger',
  CLOSED: 'neutre',
};
const VARIANTES_DOCUMENT: Record<StatutDocument, VarianteBadge> = {
  PENDING: 'info',
  VALIDATED: 'succes',
  REJECTED: 'danger',
};

/**
 * Détail d'un dossier comptable : documents (dépôt, validation, versions) et fil de messages,
 * avec les informations de la demande et l'historique d'affectation.
 * Les actions proposées suivent le rôle (comptable / entrepreneur) et l'état du dossier ;
 * les règles restent vérifiées par les services (codes 403 / 409 affichés tels quels).
 */
@Component({
  selector: 'app-dossier',
  imports: [
    DatePipe,
    FormsModule,
    RouterLink,
    BadgeComponent,
    LoaderComponent,
    DepotDocumentModalComponent,
    HistoriqueDocumentModalComponent,
    SaisieModalComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dossier.page.html',
  styleUrl: './dossier.page.scss',
  host: {
    '(document:click)': 'menuOuvert.set(null)',
    '(document:keydown.escape)': 'menuOuvert.set(null)',
    '(window:resize)': 'menuOuvert.set(null)',
    '(window:scroll)': 'menuOuvert.set(null)',
  },
})
export class DossierPage implements OnInit {
  private readonly api = inject(ComptabiliteApiService);
  private readonly notificationsToast = inject(NotificationService);
  private readonly notifications = inject(CentreNotificationsService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fil = viewChild<ElementRef<HTMLElement>>('fil');

  protected readonly estComptable = inject(AuthService).currentUserValue?.role === 'ACCOUNTANT';
  protected readonly espace = this.estComptable ? 'Espace comptable' : 'Espace startup';
  protected readonly statutsDocument = STATUTS_DOCUMENT;
  private id = '';

  // --- État ----------------------------------------------------------------------------------
  protected readonly moiId = signal<string | null>(null);
  protected readonly dossier = signal<DossierComptable | null>(null);
  protected readonly chargement = signal(true);
  protected readonly erreur = signal<string | null>(null);
  protected readonly onglet = signal<Onglet>(this.route.snapshot.queryParamMap.get('onglet') === 'messages' ? 'messages' : 'documents');

  protected readonly documents = signal<DocumentComptable[]>([]);
  /** Tous les documents, versions comprises : retrouver un document cité dans un message. */
  private readonly tousDocuments = signal<DocumentComptable[]>([]);
  protected readonly chargementDocuments = signal(true);
  protected readonly filtreStatut = signal<StatutDocument | null>(null);
  protected readonly historique = signal(false);
  protected readonly compteurs = signal<Record<StatutDocument, number> | null>(null);

  protected readonly messages = signal<MessageDossier[]>([]);
  protected readonly totalMessages = signal<number | null>(null);
  protected readonly chargementMessages = signal(true);
  protected readonly affectations = signal<AffectationDossier[]>([]);

  protected texteMessage = '';
  protected documentMessage: string | null = null;
  protected readonly envoiMessage = signal(false);
  protected readonly erreurMessage = signal<string | null>(null);

  protected readonly menuOuvert = signal<string | null>(null);
  protected readonly positionMenu = signal<{ right: number; top: number | null; bottom: number | null }>({ right: 0, top: 0, bottom: null });
  protected readonly depot = signal<{ precedent: DocumentComptable | null } | null>(null);
  protected readonly historiqueDe = signal<DocumentComptable | null>(null);
  protected readonly action = signal<Action | null>(null);
  protected readonly actionEnCours = signal(false);
  protected readonly erreurAction = signal<string | null>(null);
  protected readonly decisionEnCours = signal<string | null>(null);

  // --- Dérivés -------------------------------------------------------------------------------
  protected readonly actif = computed(() => this.dossier()?.status === 'ACTIVE');
  protected readonly peutEcrire = computed(() => ['PENDING', 'ACTIVE'].includes(this.dossier()?.status ?? ''));
  /** Ids des documents remplacés par une version plus récente (visibles avec « Anciennes versions »). */
  private readonly remplaces = computed(
    () => new Set(this.tousDocuments().map((d) => d.previousVersionId).filter((id): id is string => !!id)),
  );
  private readonly documentsParId = computed(() => new Map(this.tousDocuments().map((d) => [d.id, d])));
  /** Documents proposés dans « Document concerné » : dernières versions. */
  protected readonly documentsCitables = computed(() => this.tousDocuments().filter((d) => !this.remplaces().has(d.id)));
  protected readonly textesAction = computed(() => {
    const a = this.action();
    if (!a) return null;
    switch (a.type) {
      case 'rejeter':
        return { titre: `Rejeter « ${a.document.title} »`, texte: "L'entrepreneur sera notifié et pourra déposer une nouvelle version.", champ: 'Motif du rejet', obligatoire: true, confirmer: 'Rejeter', variante: 'danger' as const };
      case 'reviser': {
        const valider = a.document.status === 'REJECTED';
        return { titre: `Réviser « ${a.document.title} »`, texte: `Le document passera de « ${this.libelleDocument(a.document.status)} » à « ${valider ? 'Validé' : 'Rejeté'} ».`, champ: 'Motif de la révision', obligatoire: true, confirmer: valider ? 'Valider' : 'Rejeter', variante: valider ? ('primaire' as const) : ('danger' as const) };
      }
      case 'supprimer':
        return { titre: `Supprimer « ${a.document.title} » ?`, texte: 'Le document sera retiré du dossier. Son historique reste conservé.', champ: '', obligatoire: false, confirmer: 'Supprimer', variante: 'danger' as const };
      case 'refuser':
        return { titre: 'Refuser la demande', texte: "L'entrepreneur verra ce motif et pourra choisir un autre comptable.", champ: 'Motif du refus', obligatoire: true, confirmer: 'Refuser', variante: 'danger' as const };
      case 'cloturer':
        return { titre: 'Clôturer le dossier', texte: 'Le dossier passera en lecture seule : plus aucun dépôt ni message ne sera possible.', champ: '', obligatoire: false, confirmer: 'Clôturer', variante: 'primaire' as const };
    }
  });

  ngOnInit(): void {
    // L'identité d'abord : elle décide de « vous » et des messages à marquer comme lus.
    // Puis on suit l'URL : la page est réutilisée quand on passe d'un dossier à l'autre (ex. depuis la cloche).
    this.api
      .moi()
      .pipe(catchError(() => of(null)))
      .subscribe((m) => {
        this.moiId.set(m?.id ?? null);
        this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((p) => {
          const id = p.get('id') ?? '';
          if (id === this.id && this.dossier()) return;
          this.id = id;
          this.reinitialiser();
          this.chargerDossier();
        });
        this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((q) => {
          const onglet: Onglet = q.get('onglet') === 'messages' ? 'messages' : 'documents';
          if (onglet !== this.onglet()) this.choisirOnglet(onglet);
        });
      });
  }

  private reinitialiser(): void {
    this.dossier.set(null);
    this.documents.set([]);
    this.tousDocuments.set([]);
    this.messages.set([]);
    this.affectations.set([]);
    this.compteurs.set(null);
    this.totalMessages.set(null);
    this.filtreStatut.set(null);
    this.historique.set(false);
    this.chargementDocuments.set(true);
    this.chargementMessages.set(true);
    this.texteMessage = '';
    this.documentMessage = null;
  }

  // --- Chargements ---------------------------------------------------------------------------

  protected chargerDossier(): void {
    this.chargement.set(true);
    this.erreur.set(null);
    this.api
      .dossier(this.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (d) => {
          this.dossier.set(d);
          this.chargement.set(false);
          this.chargerDocuments();
          this.chargerMessages();
          this.chargerAffectations();
        },
        error: (e: unknown) => {
          this.erreur.set(
            e instanceof ApiError && (e.statut === 404 || e.statut === 403)
              ? "Ce dossier est introuvable ou vous n'y avez pas accès."
              : 'Impossible de charger le dossier.',
          );
          this.chargement.set(false);
        },
      });
  }

  private chargerDocuments(): void {
    this.chargementDocuments.set(true);
    const compter = (s: StatutDocument) => this.api.compterDocuments(this.id, s).pipe(catchError(() => of(null)));
    forkJoin({
      liste: this.api.listerDocuments(this.id, { statut: this.filtreStatut(), historique: this.historique() }),
      tous: this.api.listerDocuments(this.id, { historique: true }),
      PENDING: compter('PENDING'),
      VALIDATED: compter('VALIDATED'),
      REJECTED: compter('REJECTED'),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ liste, tous, PENDING, VALIDATED, REJECTED }) => {
          this.documents.set(liste.data);
          this.tousDocuments.set(tous.data);
          this.compteurs.set(PENDING !== null && VALIDATED !== null && REJECTED !== null ? { PENDING, VALIDATED, REJECTED } : null);
          this.chargementDocuments.set(false);
        },
        error: () => {
          this.documents.set([]);
          this.chargementDocuments.set(false);
        },
      });
  }

  private chargerMessages(defiler = false): void {
    this.api
      .listerMessages(this.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => {
          // L'API renvoie le plus récent d'abord : on affiche le fil dans l'ordre chronologique
          this.messages.set([...r.data].reverse());
          this.totalMessages.set(r.meta.total);
          this.chargementMessages.set(false);
          if (this.onglet() === 'messages') {
            this.marquerLus();
            if (defiler) this.defilerEnBas();
          }
        },
        error: () => {
          this.chargementMessages.set(false);
        },
      });
  }

  private chargerAffectations(): void {
    this.api.affectations(this.id).pipe(catchError(() => of([]))).subscribe((a) => this.affectations.set(a));
  }

  // --- Onglets et filtres --------------------------------------------------------------------

  protected choisirOnglet(onglet: Onglet): void {
    this.onglet.set(onglet);
    this.router.navigate([], { queryParams: { onglet: onglet === 'messages' ? 'messages' : null }, replaceUrl: true });
    if (onglet === 'messages') {
      this.marquerLus();
      this.defilerEnBas();
    }
  }

  protected changerFiltre(statut: StatutDocument | null): void {
    this.filtreStatut.set(statut);
    this.chargerDocuments();
  }

  protected basculerHistorique(): void {
    this.historique.update((v) => !v);
    this.chargerDocuments();
  }

  // --- Documents -----------------------------------------------------------------------------

  protected estMoi(id: string): boolean {
    return id === this.moiId();
  }

  protected estRemplace(d: DocumentComptable): boolean {
    return this.remplaces().has(d.id);
  }

  /** Le comptable décide sur les documents de l'entrepreneur, dernière version, dossier actif. */
  protected peutDecider(d: DocumentComptable): boolean {
    return this.estComptable && this.actif() && d.uploadedByRole === 'ENTREPRENEUR' && !this.estRemplace(d);
  }

  protected peutNouvelleVersion(d: DocumentComptable): boolean {
    return !this.estComptable && this.actif() && d.status === 'REJECTED' && d.uploadedByRole === 'ENTREPRENEUR' && !this.estRemplace(d);
  }

  /**
   * La Gateway réserve toute requête DELETE au rôle ADMIN (règle d'équipe, voir SecurityConfig) :
   * un comptable ou un entrepreneur recevrait un 403, le bouton n'est donc pas proposé.
   */
  protected peutSupprimer(d: DocumentComptable): boolean {
    if (!SUPPRESSION_AUTORISEE) return false;
    if (!this.actif() || !this.estMoi(d.uploadedBy) || this.estRemplace(d)) return false;
    return this.estComptable || d.status === 'PENDING';
  }

  /**
   * Le menu est positionné par rapport à la fenêtre (position: fixed) : le conteneur défilant du tableau
   * ne le coupe pas. Il s'ouvre vers le haut quand la place manque en bas.
   */
  protected basculerMenu(id: string, evenement: Event): void {
    evenement.stopPropagation();
    if (this.menuOuvert() === id) {
      this.menuOuvert.set(null);
      return;
    }
    const r = (evenement.currentTarget as HTMLElement).getBoundingClientRect();
    const versLeHaut = window.innerHeight - r.bottom < 240;
    this.positionMenu.set({
      right: Math.max(8, window.innerWidth - r.right),
      top: versLeHaut ? null : r.bottom + 4,
      bottom: versLeHaut ? window.innerHeight - r.top + 4 : null,
    });
    this.menuOuvert.set(id);
  }

  protected valider(d: DocumentComptable): void {
    this.decisionEnCours.set(d.id);
    this.api.validerDocument(d.id).subscribe({
      next: () => {
        this.decisionEnCours.set(null);
        this.notificationsToast.succes(`« ${d.title} » validé.`);
        this.apresDecision();
      },
      error: (e: unknown) => {
        this.decisionEnCours.set(null);
        this.notificationsToast.erreur(e instanceof ApiError ? e.message : 'La validation a échoué.');
      },
    });
  }

  protected telecharger(d: DocumentComptable): void {
    this.api.telechargerDocument(d.id).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const lien = document.createElement('a');
        lien.href = url;
        lien.download = d.file?.originalFilename ?? d.title;
        lien.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      },
      error: (e: unknown) => this.notificationsToast.erreur(e instanceof ApiError ? e.message : 'Téléchargement impossible.'),
    });
  }

  protected documentDepose(doc: DocumentComptable): void {
    const nouvelle = !!this.depot()?.precedent;
    this.depot.set(null);
    this.notificationsToast.succes(nouvelle ? `Nouvelle version de « ${doc.title} » déposée.` : `« ${doc.title} » déposé.`);
    this.chargerDocuments();
  }

  // --- Actions confirmées dans la fenêtre de saisie ------------------------------------------

  protected ouvrirAction(action: Action): void {
    this.menuOuvert.set(null);
    this.erreurAction.set(null);
    this.action.set(action);
  }

  protected confirmerAction(commentaire: string): void {
    const a = this.action();
    const d = this.dossier();
    if (!a || !d) return;
    let appel: Observable<unknown>;
    let succes: string;
    switch (a.type) {
      case 'rejeter':
        appel = this.api.rejeterDocument(a.document.id, commentaire);
        succes = `« ${a.document.title} » rejeté.`;
        break;
      case 'reviser':
        appel = a.document.status === 'REJECTED' ? this.api.validerDocument(a.document.id, commentaire) : this.api.rejeterDocument(a.document.id, commentaire);
        succes = 'Décision révisée.';
        break;
      case 'supprimer':
        appel = this.api.supprimerDocument(a.document.id);
        succes = `« ${a.document.title} » supprimé.`;
        break;
      case 'refuser':
        appel = this.api.refuserDossier(d.id, commentaire);
        succes = 'Demande refusée.';
        break;
      case 'cloturer':
        appel = this.api.cloturerDossier(d.id);
        succes = 'Dossier clôturé.';
        break;
    }
    this.actionEnCours.set(true);
    this.erreurAction.set(null);
    appel.subscribe({
      next: (resultat) => {
        this.actionEnCours.set(false);
        this.action.set(null);
        this.notificationsToast.succes(succes);
        if (a.type === 'refuser' || a.type === 'cloturer') {
          this.dossier.set(resultat as DossierComptable);
          this.chargerAffectations();
        } else {
          this.apresDecision();
        }
      },
      error: (e: unknown) => {
        this.actionEnCours.set(false);
        this.erreurAction.set(e instanceof ApiError ? (e.erreursChamps['comment']?.join(' ') ?? e.message) : "L'action a échoué.");
      },
    });
  }

  protected accepter(): void {
    const d = this.dossier();
    if (!d) return;
    this.actionEnCours.set(true);
    this.api.accepterDossier(d.id).subscribe({
      next: (maj) => {
        this.actionEnCours.set(false);
        this.dossier.set(maj);
        this.notificationsToast.succes(`Dossier ${maj.reference} accepté.`);
        this.chargerAffectations();
      },
      error: (e: unknown) => {
        this.actionEnCours.set(false);
        this.notificationsToast.erreur(e instanceof ApiError ? e.message : "L'acceptation a échoué.");
      },
    });
  }

  /** Une décision publie un message automatique dans le fil (RabbitMQ) : on recharge aussi les messages. */
  private apresDecision(): void {
    this.chargerDocuments();
    setTimeout(() => this.chargerMessages(), 800);
  }

  // --- Messages ------------------------------------------------------------------------------

  protected envoyerMessage(): void {
    const contenu = this.texteMessage.trim();
    if (!contenu || this.envoiMessage()) return;
    this.envoiMessage.set(true);
    this.erreurMessage.set(null);
    this.api.envoyerMessage(this.id, contenu, this.documentMessage).subscribe({
      next: () => {
        this.envoiMessage.set(false);
        this.texteMessage = '';
        this.documentMessage = null;
        this.chargerMessages(true);
      },
      error: (e: unknown) => {
        this.envoiMessage.set(false);
        this.erreurMessage.set(e instanceof ApiError ? e.message : "Le message n'a pas pu être envoyé.");
      },
    });
  }

  protected toucheMessage(evenement: KeyboardEvent): void {
    if (evenement.key === 'Enter' && (evenement.ctrlKey || evenement.metaKey)) {
      evenement.preventDefault();
      this.envoyerMessage();
    }
  }

  protected auteur(m: MessageDossier): string {
    if (m.automatic) return 'Notification automatique';
    const d = this.dossier();
    if (m.senderRole === 'ACCOUNTANT') return `${d?.workspace.displayName ?? 'Comptable'} · comptable`;
    if (m.senderRole === 'ENTREPRENEUR') return `${d?.entrepreneurDisplayName ?? 'Entrepreneur'} · entrepreneur`;
    return 'Administrateur';
  }

  protected documentCite(id: string | null): DocumentComptable | undefined {
    return id ? this.documentsParId().get(id) : undefined;
  }

  private marquerLus(): void {
    const moi = this.moiId();
    if (!moi) return;
    const nonLus = this.messages().filter((m) => !m.readAt && m.senderId !== moi);
    if (!nonLus.length) return;
    // Puis la cloche de l'en-tête se met à jour
    forkJoin(nonLus.map((m) => this.api.marquerLu(m.id).pipe(catchError(() => of(null))))).subscribe(() =>
      this.notifications.rafraichir(),
    );
  }

  private defilerEnBas(): void {
    setTimeout(() => {
      const el = this.fil()?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }

  // --- Libellés ------------------------------------------------------------------------------

  protected libelleDossier(s: StatutDossier): string {
    return STATUTS_DOSSIER.find((x) => x.statut === s)?.libelle ?? s;
  }
  protected varianteDossier(s: StatutDossier): VarianteBadge {
    return VARIANTES_DOSSIER[s];
  }
  protected libelleDocument(s: StatutDocument): string {
    return STATUTS_DOCUMENT.find((x) => x.statut === s)?.libelle ?? s;
  }
  protected varianteDocument(s: StatutDocument): VarianteBadge {
    return VARIANTES_DOCUMENT[s];
  }
  protected libelleType(d: DocumentComptable): string {
    return TYPES_DOCUMENT.find((t) => t.type === d.type)?.libelle ?? d.type;
  }
  protected deposant(d: DocumentComptable): string {
    if (this.estMoi(d.uploadedBy)) return 'par vous';
    return d.uploadedByRole === 'ACCOUNTANT' ? `par ${this.dossier()?.workspace.displayName ?? 'le comptable'}` : `par ${this.dossier()?.entrepreneurDisplayName ?? "l'entrepreneur"}`;
  }
  protected libelleAffectation(a: AffectationDossier): string {
    return a.type === 'ACCEPTANCE' ? 'Acceptation par le comptable' : a.type === 'ADMIN_ASSIGNMENT' ? 'Affectation par un administrateur' : 'Réaffectation par un administrateur';
  }
  protected nomComptable(accountantId: string): string {
    const d = this.dossier();
    return d && d.workspace.accountantId === accountantId ? d.workspace.displayName : 'Ancien comptable';
  }
  protected compteur(s: StatutDocument): string {
    const c = this.compteurs();
    return c ? String(c[s]) : '—';
  }
}
