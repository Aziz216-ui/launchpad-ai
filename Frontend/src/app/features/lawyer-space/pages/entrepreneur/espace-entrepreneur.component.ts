import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, forkJoin, of, switchMap } from 'rxjs';

import { ApiError } from '../../../../core/http/api-error';
import { NotificationService } from '../../../../core/notifications/notification.service';
import { BadgeComponent } from '../../../../shared/components/badge.component';
import { LoaderComponent } from '../../../../shared/components/loader.component';
import { ConversationComponent } from '../../components/conversation.component';
import { DemandeAvocatModalComponent } from '../../components/demande-avocat-modal.component';
import {
  Avocat,
  DemandeRevue,
  MessageAvocat,
  STATUTS_DEMANDE,
  TYPES_JURIDIQUES,
  idDocument,
  initiales,
  libelleStatutDemande,
  nomAvocat,
} from '../../models/avocat.models';
import { AvocatApiService, Relation } from '../../services/avocat-api.service';

type Onglet = 'avocats' | 'messagerie' | 'demandes';

/**
 * Espace avocat côté entrepreneur : annuaire des avocats inscrits (cartes « Message » et « Demander un
 * avocat »), messagerie avec les avocats contactés, et suivi des demandes de revue.
 */
@Component({
  selector: 'app-espace-avocat-entrepreneur',
  imports: [DatePipe, FormsModule, RouterLink, BadgeComponent, LoaderComponent, ConversationComponent, DemandeAvocatModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './espace-entrepreneur.component.html',
  styleUrl: './espace-entrepreneur.component.scss',
})
export class EspaceEntrepreneurComponent implements OnInit {
  private readonly api = inject(AvocatApiService);
  private readonly notifications = inject(NotificationService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly conversation = viewChild(ConversationComponent);

  protected readonly nomAvocat = nomAvocat;
  protected readonly initiales = initiales;
  protected readonly statutsDemande = STATUTS_DEMANDE;
  protected readonly libelleStatutDemande = libelleStatutDemande;
  protected readonly typesJuridiques = TYPES_JURIDIQUES;

  protected readonly onglet = signal<Onglet>('avocats');
  protected readonly avocats = signal<Avocat[]>([]);
  protected readonly relations = signal<Relation[]>([]);
  protected readonly demandes = signal<{ relation: Relation; demande: DemandeRevue }[]>([]);
  protected readonly chargement = signal(true);
  protected readonly erreur = signal<string | null>(null);
  protected readonly recherche = signal('');
  protected readonly demandeA = signal<Avocat | null>(null);

  // Messagerie
  protected readonly avocatActif = signal<string | null>(null);
  protected readonly messages = signal<MessageAvocat[]>([]);
  protected readonly nonLus = signal<Record<string, number>>({});
  protected readonly chargementMessages = signal(false);
  protected readonly envoi = signal(false);
  protected readonly erreurEnvoi = signal<string | null>(null);

  protected readonly filtres = computed(() => {
    const q = normaliser(this.recherche());
    return q ? this.avocats().filter((a) => normaliser(`${nomAvocat(a)} ${a.email}`).includes(q)) : this.avocats();
  });
  /** Dernière demande envoyée à chaque avocat (badge sur la carte). */
  protected readonly derniereDemande = computed(() => {
    const m: Record<string, DemandeRevue> = {};
    for (const { relation, demande } of this.demandes()) m[relation.avocat.username] ??= demande;
    return m;
  });
  /** Filtre « Demande revue » : documents ayant fait l'objet d'une demande. */
  protected readonly filtreDocument = signal<string | null>(null);
  protected readonly documentsDemandes = computed(() => {
    const vus = new Map<string, string>();
    for (const { demande } of this.demandes()) vus.set(demande.documentUrl, demande.documentTitle);
    return [...vus].map(([url, titre]) => ({ url, titre }));
  });
  protected readonly revues = computed(() => {
    const f = this.filtreDocument();
    return this.demandes()
      .filter(({ demande }) => !f || demande.documentUrl === f)
      .map((x) => {
        const commentaires = [...x.demande.comments].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        const deLAvocat = (auteur: string) => auteur.startsWith('Me ') || auteur.startsWith('Maître');
        const decision = ['NEEDS_CORRECTION', 'APPROVED', 'REJECTED'].includes(x.demande.status)
          ? ([...x.demande.history].reverse().find((h) => h.newStatus === x.demande.status)?.reason ?? null)
          : null;
        return {
          ...x,
          question: commentaires.find((c) => !deLAvocat(c.author)) ?? null,
          reponses: commentaires.filter((c) => deLAvocat(c.author)),
          decision: decision && !['Approuver le document', 'Demande acceptée'].includes(decision) ? decision : null,
          idDocument: idDocument(x.demande),
        };
      });
  });
  protected readonly relationActive = computed(() => this.relations().find((r) => r.avocat.username === this.avocatActif()) ?? null);
  protected readonly totalNonLus = computed(() => Object.values(this.nonLus()).reduce((a, b) => a + b, 0));

  ngOnInit(): void {
    const q = this.route.snapshot.queryParamMap;
    const onglet = q.get('onglet') as Onglet | null;
    if (onglet === 'messagerie' || onglet === 'demandes') this.onglet.set(onglet);
    this.avocatActif.set(q.get('avocat'));
    this.charger();
  }

  protected charger(): void {
    this.chargement.set(true);
    this.erreur.set(null);
    this.api
      .avocats()
      .pipe(
        switchMap((avocats) => {
          this.avocats.set(avocats);
          return this.api.relations(avocats);
        }),
        switchMap((relations) => {
          this.relations.set(relations);
          return forkJoin({
            demandes: this.api.demandesEntrepreneur(relations),
            messages: relations.length
              ? forkJoin(relations.map((r) => this.api.messages(r.avocat.username, r.client.id).pipe(catchError(() => of([] as MessageAvocat[])))))
              : of([] as MessageAvocat[][]),
          });
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: ({ demandes, messages }) => {
          this.demandes.set(demandes);
          const nonLus: Record<string, number> = {};
          this.relations().forEach((r, i) => (nonLus[r.avocat.username] = messages[i].filter((m) => m.senderType === 'LAWYER' && !m.isRead).length));
          this.nonLus.set(nonLus);
          this.chargement.set(false);
          if (this.onglet() === 'messagerie') this.ouvrirConversation(this.avocatActif() ?? this.relations()[0]?.avocat.username ?? null);
        },
        error: (e: unknown) => {
          this.erreur.set(e instanceof ApiError ? e.message : "Impossible de charger l'espace avocat.");
          this.chargement.set(false);
        },
      });
  }

  protected choisirOnglet(o: Onglet): void {
    this.onglet.set(o);
    this.router.navigate([], { queryParams: { onglet: o === 'avocats' ? null : o, avocat: o === 'messagerie' ? this.avocatActif() : null }, replaceUrl: true });
    if (o === 'messagerie') this.ouvrirConversation(this.avocatActif() ?? this.relations()[0]?.avocat.username ?? null);
  }

  // --- Carte avocat : icône message --------------------------------------------------------------

  /** Icône message : crée au besoin la fiche client chez l'avocat, puis ouvre la conversation. */
  protected ecrire(a: Avocat): void {
    if (this.relations().some((r) => r.avocat.username === a.username)) {
      this.avocatActif.set(a.username);
      this.choisirOnglet('messagerie');
      return;
    }
    this.api.assurerClient(a.username).subscribe({
      next: (client) => {
        this.relations.update((rs) => [...rs, { avocat: a, client }]);
        this.avocatActif.set(a.username);
        this.choisirOnglet('messagerie');
      },
      error: (e: unknown) => this.notifications.erreur(e instanceof ApiError ? e.message : "Impossible de contacter l'avocat."),
    });
  }

  protected ouvrirConversation(username: string | null): void {
    this.avocatActif.set(username);
    this.router.navigate([], { queryParams: { onglet: 'messagerie', avocat: username }, replaceUrl: true });
    const r = this.relationActive();
    if (!r) {
      this.messages.set([]);
      return;
    }
    this.chargementMessages.set(true);
    this.api.messages(r.avocat.username, r.client.id).subscribe({
      next: (ms) => {
        this.messages.set(ms);
        this.chargementMessages.set(false);
        const nonLus = ms.filter((m) => m.senderType === 'LAWYER' && !m.isRead);
        nonLus.forEach((m) => this.api.marquerLu(r.avocat.username, m.id).subscribe());
        this.nonLus.update((n) => ({ ...n, [r.avocat.username]: 0 }));
      },
      error: () => {
        this.messages.set([]);
        this.chargementMessages.set(false);
      },
    });
  }

  protected envoyer(texte: string): void {
    const r = this.relationActive();
    if (!r) return;
    this.envoi.set(true);
    this.erreurEnvoi.set(null);
    this.api.envoyerMessage(r.avocat.username, r.client.id, texte).subscribe({
      next: (m) => {
        this.envoi.set(false);
        this.messages.update((ms) => [...ms, m]);
        this.conversation()?.vider();
      },
      error: (e: unknown) => {
        this.envoi.set(false);
        this.erreurEnvoi.set(e instanceof ApiError ? e.message : "Le message n'a pas pu être envoyé.");
      },
    });
  }

  // --- Demandes ---------------------------------------------------------------------------------

  protected demandeEnvoyee(demande: DemandeRevue): void {
    const avocat = this.demandeA();
    this.demandeA.set(null);
    this.notifications.succes(`Demande envoyée à ${avocat ? nomAvocat(avocat) : "l'avocat"} : « ${demande.documentTitle} ».`);
    this.onglet.set('demandes');
    this.router.navigate([], { queryParams: { onglet: 'demandes' }, replaceUrl: true });
    this.charger();
  }

  protected ouvrirDemande(d: DemandeRevue): void {
    this.router.navigate(['/professional/avocat/demandes', d.id], { queryParams: { avocat: d.lawyerId } });
  }
}

function normaliser(t: string): string {
  return t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}
