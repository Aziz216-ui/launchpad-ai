import { ChangeDetectionStrategy, Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { NotificationService } from '../../../core/notifications/notification.service';
import { messageErreur } from '../services/erreurs';
import { FinanceApiService } from '../services/finance-api.service';
import { FinanceStore } from '../services/finance-store.service';

interface Echange {
  auteur: 'moi' | 'ia';
  texte: string;
}

const SUGGESTIONS = [
  'Quelles sont mes marges ?',
  'Génère mon business plan',
  'Génère mon plan de trésorerie',
];

/** Assistant financier IA : le modèle appelle les outils du projet (marges, génération de document). */
@Component({
  selector: 'app-finance-assistant',
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <section class="carte conversation">
        <div class="entete-carte">
          <div>
            <h2>Assistant financier</h2>
            <span class="sous-titre">Posez une question sur les finances du projet. Les chiffres viennent du calcul, pas du modèle.</span>
          </div>
        </div>

        <div class="fil" #fil aria-live="polite">
          @if (!echanges().length) {
            <p class="vide">Essayez par exemple :</p>
            <div class="actions">
              @for (s of suggestions; track s) {
                <button type="button" class="btn-secondaire" (click)="envoyer(s)" [disabled]="enCours()">{{ s }}</button>
              }
            </div>
          }
          @for (e of echanges(); track $index) {
            <div class="bulle" [class.moi]="e.auteur === 'moi'" [class.ia]="e.auteur === 'ia'">
              <span class="auteur">{{ e.auteur === 'moi' ? 'Vous' : 'Assistant IA' }}</span>
              <p>{{ e.texte }}</p>
            </div>
          }
          @if (enCours()) {
            <div class="bulle ia"><span class="auteur">Assistant IA</span><p>Réflexion en cours…</p></div>
          }
        </div>

        <form class="saisie" (ngSubmit)="envoyer(message)" novalidate>
          <label class="champ saisie-champ">
            <span class="sr-only">Votre question</span>
            <input name="message" [(ngModel)]="message" maxlength="2000" placeholder="Votre question…" autocomplete="off" />
          </label>
          <button type="submit" class="btn-primaire" [disabled]="enCours() || !message.trim()">Envoyer</button>
        </form>
      </section>
    </div>
  `,
  styles: `
    .conversation {
      max-width: 820px;
    }
    .fil {
      display: flex;
      flex-direction: column;
      gap: 12px;
      min-height: 260px;
      max-height: 55vh;
      overflow-y: auto;
      padding: 4px 2px;
    }
    .vide {
      color: #5a6a6f;
    }
    .bulle {
      max-width: 85%;
      border-radius: 14px;
      padding: 10px 14px;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .bulle p {
      white-space: pre-line;
      color: inherit !important;
    }
    .bulle.moi {
      align-self: flex-end;
      background: #2b7a86;
      color: #ffffff;
    }
    .bulle.ia {
      align-self: flex-start;
      background: #f1f4f5;
      color: #1d2b2f;
    }
    .auteur {
      font-size: 11px;
      opacity: 0.75;
    }
    .saisie {
      display: flex;
      gap: 10px;
      align-items: flex-end;
    }
    .saisie-champ {
      flex: 1;
    }
    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip: rect(0 0 0 0);
    }
  `,
})
export class AssistantPage {
  private readonly store = inject(FinanceStore);
  private readonly api = inject(FinanceApiService);
  private readonly notifications = inject(NotificationService);
  private readonly fil = viewChild<ElementRef<HTMLElement>>('fil');

  protected readonly suggestions = SUGGESTIONS;
  protected readonly echanges = signal<Echange[]>([]);
  protected readonly enCours = signal(false);
  protected message = '';

  protected envoyer(texte: string): void {
    const question = texte.trim();
    if (!question || this.enCours()) return;
    this.echanges.update((liste) => [...liste, { auteur: 'moi', texte: question }]);
    this.message = '';
    this.enCours.set(true);
    this.faireDefiler();
    this.api.poserQuestion(this.store.projetId(), question).subscribe({
      next: (r) => {
        this.echanges.update((liste) => [...liste, { auteur: 'ia', texte: r.reponse }]);
        this.enCours.set(false);
        this.faireDefiler();
      },
      error: (e: unknown) => {
        messageErreur(e, this.notifications);
        this.enCours.set(false);
      },
    });
  }

  private faireDefiler(): void {
    setTimeout(() => {
      const element = this.fil()?.nativeElement;
      if (element) element.scrollTop = element.scrollHeight;
    });
  }
}
