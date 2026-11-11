import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { Clause } from '../models/legal.models';

export interface ModificationClause {
  numero: number;
  texte: string;
  titre: string | null;
}

/**
 * Clauses d'un document, avec édition en place quand `modifiable` est vrai.
 * `titreModifiable` : l'entrepreneur peut renommer une clause (brouillon), l'avocat ne corrige que le texte.
 * L'enregistrement est fait par le parent (sortie `enregistrer`), qui signale la fin via `enCours`.
 */
@Component({
  selector: 'app-clauses',
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ol class="clauses">
      @for (c of clauses(); track c.id) {
        <li [class.edition]="edition() === c.numero">
          <div class="entete">
            <span class="numero">Article {{ c.numero }}</span>
            @if (edition() !== c.numero && modifiable()) {
              <button type="button" class="modifier" (click)="ouvrir(c)" [attr.aria-label]="'Modifier l\\'article ' + c.numero">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"></path></svg>
                {{ libelleModifier() }}
              </button>
            }
          </div>

          @if (edition() === c.numero) {
            <form (ngSubmit)="valider(c)" class="formulaire">
              @if (titreModifiable()) {
                <label>
                  <span>Titre</span>
                  <input name="titre" [(ngModel)]="titre" maxlength="200" />
                </label>
              } @else if (c.titre) {
                <h3>{{ c.titre }}</h3>
              }
              <label>
                <span>Texte de la clause</span>
                <textarea name="texte" [(ngModel)]="texte" rows="6" [attr.aria-invalid]="erreurLocale() ? true : null"></textarea>
              </label>
              @if (erreurLocale() || erreur(); as e) {
                <p class="alerte" role="alert">{{ e }}</p>
              }
              <div class="boutons">
                <button type="button" class="secondaire" (click)="fermer()" [disabled]="enCours()">Annuler</button>
                <button type="submit" class="primaire" [disabled]="enCours()">{{ enCours() ? 'Enregistrement…' : 'Enregistrer' }}</button>
              </div>
            </form>
          } @else {
            @if (c.titre) {
              <h3>{{ c.titre }}</h3>
            }
            <p class="texte">{{ c.texte }}</p>
          }
        </li>
      } @empty {
        <li class="vide">Aucune clause.</li>
      }
    </ol>
  `,
  styles: `
    .clauses {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    li {
      padding: 16px 18px;
      border: 1px solid #eef2f3;
      border-radius: 12px;
      background: #ffffff;
    }
    li.edition {
      border-color: #2b7a86;
      box-shadow: 0 0 0 3px rgba(43, 122, 134, 0.12);
    }
    .entete {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      margin-bottom: 6px;
    }
    .numero {
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: #2b7a86;
    }
    h3 {
      margin: 0 0 6px;
      font-size: 15px;
      font-weight: 600;
    }
    .texte {
      margin: 0;
      font-size: 14px;
      line-height: 1.65;
      color: #3d5257;
      white-space: pre-wrap;
    }
    .modifier {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-height: 32px;
      padding: 0 10px;
      border: 1px solid #e3e8ea;
      border-radius: 8px;
      background: #ffffff;
      color: #1f6470;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
    }
    .modifier:hover {
      border-color: #2b7a86;
      background: #f8fafa;
    }
    .formulaire {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    label {
      display: flex;
      flex-direction: column;
      gap: 6px;
      font-size: 13px;
      font-weight: 500;
      color: #3d5257;
    }
    input,
    textarea {
      padding: 10px 12px;
      border: 1px solid #cfd8db;
      border-radius: 10px;
      color: #1d2b2f;
      font-size: 14px;
      line-height: 1.55;
      font-weight: 400;
    }
    textarea {
      resize: vertical;
    }
    input:focus,
    textarea:focus {
      outline: none;
      border-color: #2b7a86;
      box-shadow: 0 0 0 3px rgba(43, 122, 134, 0.18);
    }
    [aria-invalid='true'] {
      border-color: #b23a3a;
    }
    .alerte {
      margin: 0;
      padding: 10px 12px;
      border-radius: 10px;
      background: #fbeded;
      color: #8e2b2b;
      font-size: 13px;
    }
    .boutons {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
    }
    .boutons button {
      min-height: 40px;
      padding: 0 16px;
      border-radius: 10px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
    }
    button:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    .secondaire {
      border: 1px solid #cfd8db;
      background: #ffffff;
      color: #1d2b2f;
    }
    .primaire {
      border: 0;
      background: #2b7a86;
      color: #ffffff;
    }
    .vide {
      color: #5a6a6f;
      font-size: 14px;
    }
  `,
})
export class ClausesComponent {
  readonly clauses = input.required<Clause[]>();
  readonly modifiable = input(false);
  readonly titreModifiable = input(false);
  readonly libelleModifier = input('Modifier');
  readonly enCours = input(false);
  readonly erreur = input<string | null>(null);
  readonly enregistrer = output<ModificationClause>();

  protected readonly edition = signal<number | null>(null);
  protected readonly erreurLocale = signal<string | null>(null);
  protected texte = '';
  protected titre = '';

  protected ouvrir(c: Clause): void {
    this.edition.set(c.numero);
    this.texte = c.texte;
    this.titre = c.titre ?? '';
    this.erreurLocale.set(null);
  }

  /** Appelé par le parent une fois l'enregistrement réussi. */
  fermer(): void {
    this.edition.set(null);
    this.erreurLocale.set(null);
  }

  protected valider(c: Clause): void {
    const texte = this.texte.trim();
    if (!texte) {
      this.erreurLocale.set('Le texte de la clause ne peut pas être vide.');
      return;
    }
    const titre = this.titre.trim();
    if (texte === c.texte && (!this.titreModifiable() || titre === (c.titre ?? ''))) {
      this.fermer();
      return;
    }
    this.erreurLocale.set(null);
    this.enregistrer.emit({ numero: c.numero, texte, titre: this.titreModifiable() ? titre || null : null });
  }
}
