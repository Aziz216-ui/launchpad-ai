import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, ElementRef, effect, input, output, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { LoaderComponent } from '../../../shared/components/loader.component';
import { MessageAvocat } from '../models/avocat.models';

/** Fil de messages entre un avocat et un entrepreneur, avec la zone de saisie (Ctrl + Entrée pour envoyer). */
@Component({
  selector: 'app-conversation',
  imports: [DatePipe, FormsModule, LoaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="entete">
      <span class="avatar" aria-hidden="true">{{ initialesInterlocuteur() }}</span>
      <div>
        <strong>{{ interlocuteur() }}</strong>
        <small>{{ sousTitre() }}</small>
      </div>
    </header>

    <div class="fil" #fil aria-live="polite">
      @if (chargement()) {
        <app-loader texte="Chargement des messages…" />
      } @else if (!messages().length) {
        <p class="vide">Aucun message pour l'instant. Écrivez le premier ci-dessous.</p>
      } @else {
        @for (m of messages(); track m.id) {
          @let moi = m.senderType === monRole();
          <article class="message" [class.moi]="moi">
            <header>
              <strong>{{ moi ? 'Vous' : interlocuteur() }}</strong>
              <time>{{ m.sentAt | date: 'dd/MM/y HH:mm' }}</time>
            </header>
            <p class="bulle">{{ m.content }}</p>
            @if (moi) {
              <small class="lu">{{ m.isRead ? 'Lu' : 'Envoyé' }}</small>
            }
          </article>
        }
      }
    </div>

    <form class="composer" (ngSubmit)="envoyer()">
      <label class="masque" [for]="idChamp">Votre message</label>
      <textarea [id]="idChamp" name="texte" [(ngModel)]="texte" rows="3" maxlength="4000"
        [placeholder]="'Écrire à ' + interlocuteur() + '…'" (keydown)="touche($event)"></textarea>
      <div class="bas">
        <small>Ctrl + Entrée pour envoyer</small>
        @if (erreur()) { <span class="erreur" role="alert">{{ erreur() }}</span> }
        <button type="submit" [disabled]="envoi() || !texte.trim()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4z"></path></svg>
          {{ envoi() ? 'Envoi…' : 'Envoyer' }}
        </button>
      </div>
    </form>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      min-height: 480px;
      min-width: 0;
    }
    .entete {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px 20px;
      border-bottom: 1px solid #eef2f3;

      div {
        display: flex;
        flex-direction: column;
      }
      strong {
        font-size: 15px;
      }
      small {
        font-size: 12px;
        color: #5a6a6f;
      }
    }
    .avatar {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: #e3f0f1;
      color: #1f6470;
      font-size: 13px;
      font-weight: 600;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .fil {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 16px;
      max-height: 460px;
      overflow-y: auto;
      padding: 20px;
    }
    .vide {
      margin: auto;
      color: #5a6a6f;
      font-size: 14px;
      text-align: center;
    }
    .message {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 4px;
      max-width: 80%;

      header {
        display: flex;
        gap: 8px;
        font-size: 12px;
      }
      time {
        color: #5a6a6f;
      }
      .bulle {
        margin: 0;
        padding: 10px 14px;
        border-radius: 12px;
        background: #f1f4f5;
        font-size: 14px;
        line-height: 1.5;
        white-space: pre-wrap;
        overflow-wrap: anywhere;
      }
      .lu {
        font-size: 11px;
        color: #5a6a6f;
      }
      &.moi {
        align-self: flex-end;
        align-items: flex-end;

        .bulle {
          background: #e3f0f1;
          color: #174e57;
        }
      }
    }
    .composer {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 16px 20px 20px;
      border-top: 1px solid #e3e8ea;
    }
    textarea {
      padding: 12px 14px;
      border: 1px solid #cfd8db;
      border-radius: 10px;
      font-size: 14px;
      color: #1d2b2f;
      resize: vertical;
    }
    textarea:focus {
      outline: none;
      border-color: #2b7a86;
      box-shadow: 0 0 0 3px rgba(43, 122, 134, 0.18);
    }
    .bas {
      display: flex;
      align-items: center;
      gap: 12px;

      small {
        font-size: 12px;
        color: #5a6a6f;
        margin-right: auto;
      }
    }
    .erreur {
      font-size: 12px;
      color: #8e2b2b;
    }
    button {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      min-height: 42px;
      padding: 0 18px;
      border: 0;
      border-radius: 10px;
      background: #2b7a86;
      color: #ffffff;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
    }
    button:disabled {
      opacity: 0.55;
      cursor: not-allowed;
    }
    .masque {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip: rect(0 0 0 0);
    }
  `,
})
export class ConversationComponent {
  private static compteur = 0;
  protected readonly idChamp = `message-${++ConversationComponent.compteur}`;
  private readonly fil = viewChild<ElementRef<HTMLElement>>('fil');

  readonly messages = input.required<MessageAvocat[]>();
  readonly interlocuteur = input.required<string>();
  readonly sousTitre = input('');
  /** Expéditeur « moi » : LAWYER côté avocat, CLIENT côté entrepreneur. */
  readonly monRole = input.required<'LAWYER' | 'CLIENT'>();
  readonly chargement = input(false);
  readonly envoi = input(false);
  readonly erreur = input<string | null>(null);
  readonly envoye = output<string>();

  protected texte = '';

  constructor() {
    // Faire défiler en bas à chaque nouveau message
    effect(() => {
      this.messages();
      setTimeout(() => {
        const el = this.fil()?.nativeElement;
        if (el) el.scrollTop = el.scrollHeight;
      });
    });
  }

  protected initialesInterlocuteur(): string {
    const mots = this.interlocuteur().replace(/^Maître\s+/, '').split(/\s+/).filter(Boolean);
    return ((mots[0]?.[0] ?? '') + (mots.length > 1 ? mots[mots.length - 1][0] : '')).toUpperCase() || '?';
  }

  protected touche(e: KeyboardEvent): void {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      this.envoyer();
    }
  }

  protected envoyer(): void {
    const t = this.texte.trim();
    if (t && !this.envoi()) this.envoye.emit(t);
  }

  /** Appelé par le parent après un envoi réussi. */
  vider(): void {
    this.texte = '';
  }
}
