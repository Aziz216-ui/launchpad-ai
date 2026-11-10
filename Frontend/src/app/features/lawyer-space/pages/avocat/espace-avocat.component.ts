import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';

import { ApiError } from '../../../../core/http/api-error';
import { NotificationService } from '../../../../core/notifications/notification.service';
import { BadgeComponent } from '../../../../shared/components/badge.component';
import { LoaderComponent } from '../../../../shared/components/loader.component';
import { SaisieModalComponent } from '../../../../shared/components/saisie-modal.component';
import { ConversationComponent } from '../../components/conversation.component';
import {
  ClientAvocat,
  DemandeRevue,
  MessageAvocat,
  STATUTS_DEMANDE,
  StatutDemande,
  TYPES_JURIDIQUES,
  initiales,
  libelleStatutDemande,
} from '../../models/avocat.models';
import { AvocatApiService } from '../../services/avocat-api.service';

type Onglet = 'demandes' | 'messagerie' | 'clients';
type Filtre = 'attente' | 'revue' | 'terminees';

const FILTRES: { cle: Filtre; libelle: string; statuts: StatutDemande[] }[] = [
  { cle: 'attente', libelle: 'En attente', statuts: ['PENDING'] },
  { cle: 'revue', libelle: 'En revue', statuts: ['IN_PROGRESS', 'NEEDS_CORRECTION'] },
  { cle: 'terminees', libelle: 'Terminées', statuts: ['APPROVED', 'REJECTED'] },
];

/** Espace avocat côté avocat : demandes de revue reçues (accepter / refuser), messagerie et clients. */
@Component({
  selector: 'app-espace-avocat',
  imports: [DatePipe, RouterLink, BadgeComponent, LoaderComponent, SaisieModalComponent, ConversationComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './espace-avocat.component.html',
  styleUrl: './espace-avocat.component.scss',
})
export class EspaceAvocatComponent implements OnInit {
  private readonly api = inject(AvocatApiService);
  private readonly notifications = inject(NotificationService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly conversation = viewChild(ConversationComponent);

  protected readonly filtresDemandes = FILTRES;
  protected readonly statutsDemande = STATUTS_DEMANDE;
  protected readonly libelleStatutDemande = libelleStatutDemande;
  protected readonly typesJuridiques = TYPES_JURIDIQUES;
  protected readonly initiales = initiales;

  protected readonly onglet = signal<Onglet>('demandes');
  protected readonly filtre = signal<Filtre>('attente');
  protected readonly demandes = signal<DemandeRevue[]>([]);
  protected readonly clients = signal<ClientAvocat[]>([]);
  protected readonly tousMessages = signal<MessageAvocat[]>([]);
  protected readonly chargement = signal(true);
  protected readonly erreur = signal<string | null>(null);

  protected readonly aRefuser = signal<DemandeRevue | null>(null);
  protected readonly actionEnCours = signal<number | null>(null);
  protected readonly erreurRefus = signal<string | null>(null);

  protected readonly clientActif = signal<number | null>(null);
  protected readonly messages = signal<MessageAvocat[]>([]);
  protected readonly chargementMessages = signal(false);
  protected readonly envoi = signal(false);
  protected readonly erreurEnvoi = signal<string | null>(null);

  protected readonly compteurs = computed(() => {
    const c: Record<string, number> = {};
    for (const f of FILTRES) c[f.cle] = this.demandes().filter((d) => f.statuts.includes(d.status)).length;
    return c;
  });
  protected readonly demandesFiltrees = computed(() => {
    const statuts = FILTRES.find((f) => f.cle === this.filtre())!.statuts;
    return this.demandes().filter((d) => statuts.includes(d.status));
  });
  protected readonly nonLus = computed(() => {
    const n: Record<number, number> = {};
    for (const m of this.tousMessages()) if (m.senderType === 'CLIENT' && !m.isRead) n[m.clientId] = (n[m.clientId] ?? 0) + 1;
    return n;
  });
  protected readonly totalNonLus = computed(() => Object.values(this.nonLus()).reduce((a, b) => a + b, 0));
  protected readonly clientCourant = computed(() => this.clients().find((c) => c.id === this.clientActif()) ?? null);

  ngOnInit(): void {
    const q = this.route.snapshot.queryParamMap;
    const o = q.get('onglet') as Onglet | null;
    if (o === 'messagerie' || o === 'clients') this.onglet.set(o);
    const client = Number(q.get('client'));
    if (client) this.clientActif.set(client);
    this.charger();
  }

  protected charger(): void {
    this.chargement.set(true);
    this.erreur.set(null);
    forkJoin({
      demandes: this.api.demandesAvocat(),
      clients: this.api.clientsAvocat().pipe(catchError(() => of([] as ClientAvocat[]))),
      messages: this.api.tousMessagesAvocat().pipe(catchError(() => of([] as MessageAvocat[]))),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ demandes, clients, messages }) => {
          this.demandes.set([...demandes].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
          this.clients.set(clients);
          this.tousMessages.set(messages);
          this.chargement.set(false);
          if (!this.compteurs()['attente'] && this.compteurs()['revue']) this.filtre.set('revue');
          if (this.onglet() === 'messagerie') this.ouvrirConversation(this.clientActif() ?? this.clients()[0]?.id ?? null);
        },
        error: (e: unknown) => {
          this.erreur.set(e instanceof ApiError ? e.message : 'Impossible de charger vos demandes.');
          this.chargement.set(false);
        },
      });
  }

  protected choisirOnglet(o: Onglet): void {
    this.onglet.set(o);
    this.router.navigate([], { queryParams: { onglet: o === 'demandes' ? null : o, client: o === 'messagerie' ? this.clientActif() : null }, replaceUrl: true });
    if (o === 'messagerie') this.ouvrirConversation(this.clientActif() ?? this.clients()[0]?.id ?? null);
  }

  // --- Demandes : accepter / refuser ------------------------------------------------------------

  protected ouvrir(d: DemandeRevue): void {
    this.router.navigate(['/professional/avocat/demandes', d.id]);
  }

  protected accepter(d: DemandeRevue, e: Event): void {
    e.stopPropagation();
    this.actionEnCours.set(d.id);
    this.api.decider(d.id, 'IN_PROGRESS', 'Demande acceptée').subscribe({
      next: (maj) => {
        this.actionEnCours.set(null);
        this.notifications.succes(`Demande acceptée : « ${maj.documentTitle} » est en revue.`);
        this.router.navigate(['/professional/avocat/demandes', maj.id]);
      },
      error: (err: unknown) => {
        this.actionEnCours.set(null);
        this.notifications.erreur(err instanceof ApiError ? err.message : "L'acceptation a échoué.");
      },
    });
  }

  protected demanderRefus(d: DemandeRevue, e: Event): void {
    e.stopPropagation();
    this.erreurRefus.set(null);
    this.aRefuser.set(d);
  }

  protected refuser(motif: string): void {
    const d = this.aRefuser();
    if (!d) return;
    this.actionEnCours.set(d.id);
    this.api.decider(d.id, 'REJECTED', motif).subscribe({
      next: (maj) => {
        this.actionEnCours.set(null);
        this.aRefuser.set(null);
        this.demandes.update((ds) => ds.map((x) => (x.id === maj.id ? maj : x)));
        this.notifications.succes('Demande refusée.');
      },
      error: (err: unknown) => {
        this.actionEnCours.set(null);
        this.erreurRefus.set(err instanceof ApiError ? err.message : 'Le refus a échoué.');
      },
    });
  }

  protected compterDemandes(clientId: number): number {
    return this.demandes().filter((d) => d.clientId === clientId).length;
  }

  // --- Messagerie --------------------------------------------------------------------------------

  protected ecrireA(c: ClientAvocat): void {
    this.clientActif.set(c.id);
    this.choisirOnglet('messagerie');
  }

  protected ouvrirConversation(clientId: number | null): void {
    this.clientActif.set(clientId);
    this.router.navigate([], { queryParams: { onglet: 'messagerie', client: clientId }, replaceUrl: true });
    if (!clientId) {
      this.messages.set([]);
      return;
    }
    this.chargementMessages.set(true);
    this.api.messages(undefined, clientId).subscribe({
      next: (ms) => {
        this.messages.set(ms);
        this.chargementMessages.set(false);
        const aLire = ms.filter((m) => m.senderType === 'CLIENT' && !m.isRead);
        aLire.forEach((m) => this.api.marquerLu(undefined, m.id).subscribe());
        if (aLire.length) {
          const ids = new Set(aLire.map((m) => m.id));
          this.tousMessages.update((all) => all.map((m) => (ids.has(m.id) ? { ...m, isRead: true } : m)));
        }
      },
      error: () => {
        this.messages.set([]);
        this.chargementMessages.set(false);
      },
    });
  }

  protected envoyer(texte: string): void {
    const c = this.clientCourant();
    if (!c) return;
    this.envoi.set(true);
    this.erreurEnvoi.set(null);
    this.api.envoyerMessage(undefined, c.id, texte).subscribe({
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
}
