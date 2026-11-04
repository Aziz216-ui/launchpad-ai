import {
  AfterViewChecked,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';

import { environment } from '../../../../../environments/environment';
import { EmptyStateComponent } from '../../../../shared/components/empty-state.component';
import { IconComponent } from '../../../../shared/components/icon.component';
import { LoaderComponent } from '../../../../shared/components/loader.component';
import { NotificationService } from '../../../../core/notifications/notification.service';
import { ConversationApiService } from '../../services/conversation-api.service';
import { Conversation, ConversationDetail, Message } from '../../models/ai.models';

/**
 * Page « Chat Co-Fondateur » (maquettes Co-Fondateur IA).
 * Panneau gauche : liste des sessions ; panneau droit : fil de messages.
 */
@Component({
  selector: 'app-chat',
  imports: [DatePipe, RouterLink, FormsModule, EmptyStateComponent, IconComponent, LoaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './chat.page.html',
  styleUrl: './chat.page.scss',
})
export class ChatPage implements AfterViewChecked {
  @ViewChild('messagesRef') private messagesRef?: ElementRef<HTMLDivElement>;

  private readonly api = inject(ConversationApiService);
  private readonly notifications = inject(NotificationService);

  protected readonly projetId = environment.utilisateur.projetId;

  protected readonly conversations = signal<Conversation[]>([]);
  protected readonly conversationActive = signal<ConversationDetail | null>(null);
  protected readonly chargementConvs = signal(true);
  protected readonly chargementMessages = signal(false);
  protected readonly envoiEnCours = signal(false);
  protected readonly messageEnCours = signal('');
  protected readonly creationEnCours = signal(false);
  protected readonly panneauGaucheOuvert = signal(true); // mobile: toggle

  private doitDefiler = false;

  constructor() {
    this.chargerConversations();
  }

  ngAfterViewChecked(): void {
    if (this.doitDefiler && this.messagesRef) {
      const el = this.messagesRef.nativeElement;
      el.scrollTop = el.scrollHeight;
      this.doitDefiler = false;
    }
  }

  protected chargerConversations(): void {
    this.chargementConvs.set(true);
    this.api.listerConversations(this.projetId).subscribe({
      next: (convs) => {
        const triees = [...convs].sort((a, b) => b.date_mise_a_jour.localeCompare(a.date_mise_a_jour));
        this.conversations.set(triees);
        this.chargementConvs.set(false);
        // Ouvrir la plus récente automatiquement
        if (triees.length > 0 && !this.conversationActive()) {
          this.ouvrirConversation(triees[0]);
        }
      },
      error: () => {
        this.chargementConvs.set(false);
      },
    });
  }

  protected ouvrirConversation(conv: Conversation): void {
    this.chargementMessages.set(true);
    this.api.lireConversation(conv.id).subscribe({
      next: (detail) => {
        this.conversationActive.set(detail);
        this.chargementMessages.set(false);
        this.doitDefiler = true;
        // Sur mobile, fermer le panneau gauche
        if (window.innerWidth < 800) this.panneauGaucheOuvert.set(false);
      },
      error: () => {
        this.chargementMessages.set(false);
        this.notifications.erreur('Impossible de charger la conversation.');
      },
    });
  }

  protected nouvelleConversation(): void {
    const titre = `Conversation ${new Date().toLocaleDateString('fr', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}`;
    this.creationEnCours.set(true);
    this.api.creerConversation(this.projetId, titre).subscribe({
      next: (conv) => {
        this.conversations.update((liste) => [conv, ...liste]);
        this.creationEnCours.set(false);
        this.ouvrirConversation(conv);
      },
      error: () => {
        this.creationEnCours.set(false);
        this.notifications.erreur('Impossible de créer une nouvelle conversation.');
      },
    });
  }

  protected envoyerMessage(): void {
    const contenu = this.messageEnCours().trim();
    const conv = this.conversationActive();
    if (!contenu || !conv) return;

    this.messageEnCours.set('');
    this.envoiEnCours.set(true);

    // Ajout optimiste du message utilisateur
    const msgUser: Message = {
      id: -Date.now(),
      conversation_id: conv.id,
      role: 'utilisateur',
      contenu,
      date_creation: new Date().toISOString(),
    };
    this.conversationActive.update((c) => c ? { ...c, messages: [...c.messages, msgUser] } : c);
    this.doitDefiler = true;

    this.api.envoyerMessage(conv.id, contenu).subscribe({
      next: (reponse) => {
        // Remplacer le msg optimiste + ajouter la réponse IA
        this.conversationActive.update((c) => {
          if (!c) return c;
          const msgs = c.messages.filter((m) => m.id !== msgUser.id);
          return { ...c, messages: [...msgs, { ...msgUser, id: reponse.id - 1 }, reponse] };
        });
        this.envoiEnCours.set(false);
        this.doitDefiler = true;
        // Mettre à jour la date dans la liste
        this.conversations.update((liste) =>
          liste.map((c) =>
            c.id === conv.id ? { ...c, date_mise_a_jour: new Date().toISOString() } : c,
          ),
        );
      },
      error: () => {
        // Retirer le message optimiste en cas d'erreur
        this.conversationActive.update((c) =>
          c ? { ...c, messages: c.messages.filter((m) => m.id !== msgUser.id) } : c,
        );
        this.messageEnCours.set(contenu);
        this.envoiEnCours.set(false);
        this.notifications.erreur("Impossible d'envoyer le message.");
      },
    });
  }

  protected surEntree(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.envoyerMessage();
    }
  }

  protected estActive(conv: Conversation): boolean {
    return this.conversationActive()?.id === conv.id;
  }

  protected togglePanneauGauche(): void {
    this.panneauGaucheOuvert.update((v) => !v);
  }
}

