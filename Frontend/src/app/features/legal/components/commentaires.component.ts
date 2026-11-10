import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { Commentaire } from '../models/legal.models';

const PREFIXE_QUESTION = "[Demande d'informations]";

/**
 * Notes juridiques et questions de l'avocat sur un document, avec un champ de réponse optionnel.
 * Les demandes d'informations sont enregistrées par le Legal-Service comme des commentaires préfixés.
 */
@Component({
  selector: 'app-commentaires',
  imports: [DatePipe, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (tries().length) {
      <ol class="fil">
        @for (c of tries(); track c.id) {
          <li [class.question]="c.question">
            <header>
              <strong>{{ c.auteur }}</strong>
              @if (c.question) {
                <span class="etiquette">Question</span>
              }
              <time>{{ c.date | date: 'dd/MM/y HH:mm' }}</time>
            </header>
            <p>{{ c.texte }}</p>
          </li>
        }
      </ol>
    } @else {
      <p class="vide">{{ texteVide() }}</p>
    }

    @if (libelleReponse()) {
      <form class="reponse" (ngSubmit)="envoyer()">
        <label [for]="idChamp">{{ libelleReponse() }}</label>
        <textarea [id]="idChamp" name="texte" [(ngModel)]="texte" rows="3" [placeholder]="placeholder()"></textarea>
        <div class="bas">
          @if (erreur()) {
            <p class="alerte" role="alert">{{ erreur() }}</p>
          }
          <button type="submit" [disabled]="enCours() || !texte.trim()">{{ enCours() ? 'Envoi…' : libelleEnvoyer() }}</button>
        </div>
      </form>
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .fil {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    li {
      padding: 12px 14px;
      border-radius: 12px;
      background: #f6f8f9;
    }
    li.question {
      background: #fdf3e3;
    }
    header {
      display: flex;
      align-items: baseline;
      gap: 8px;
      flex-wrap: wrap;
      font-size: 12px;
    }
    header strong {
      font-weight: 600;
    }
    time {
      margin-left: auto;
      color: #5a6a6f;
    }
    .etiquette {
      padding: 1px 8px;
      border-radius: 999px;
      background: #ffffff;
      color: #9a5b07;
      font-size: 11px;
      font-weight: 600;
    }
    li p {
      margin: 6px 0 0;
      font-size: 13px;
      line-height: 1.55;
      color: #3d5257;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }
    .vide {
      margin: 0;
      font-size: 13px;
      color: #5a6a6f;
    }
    .reponse {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    label {
      font-size: 13px;
      font-weight: 500;
      color: #3d5257;
    }
    textarea {
      padding: 10px 12px;
      border: 1px solid #cfd8db;
      border-radius: 10px;
      color: #1d2b2f;
      font-size: 14px;
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
      gap: 10px;
      justify-content: flex-end;
    }
    .alerte {
      margin: 0 auto 0 0;
      font-size: 12px;
      color: #8e2b2b;
    }
    button {
      min-height: 40px;
      padding: 0 16px;
      border: 0;
      border-radius: 10px;
      background: #2b7a86;
      color: #ffffff;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
    }
    button:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
  `,
})
export class CommentairesComponent {
  private static compteur = 0;
  protected readonly idChamp = `reponse-${++CommentairesComponent.compteur}`;

  readonly commentaires = input.required<Commentaire[]>();
  readonly texteVide = input("Aucune note de l'avocat pour le moment.");
  /** Vide : pas de champ de saisie. */
  readonly libelleReponse = input('');
  readonly placeholder = input('');
  readonly libelleEnvoyer = input('Envoyer');
  readonly enCours = input(false);
  readonly erreur = input<string | null>(null);
  readonly envoye = output<string>();

  protected texte = '';
  protected readonly tries = computed(() =>
    [...this.commentaires()]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((c) => ({
        ...c,
        question: c.texte.startsWith(PREFIXE_QUESTION),
        texte: c.texte.startsWith(PREFIXE_QUESTION) ? c.texte.slice(PREFIXE_QUESTION.length).trim() : c.texte,
      })),
  );

  protected envoyer(): void {
    const t = this.texte.trim();
    if (t) this.envoye.emit(t);
  }

  /** Appelé par le parent après un envoi réussi. */
  vider(): void {
    this.texte = '';
  }
}
