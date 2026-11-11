import { ChangeDetectionStrategy, Component, OnInit, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { ApiError } from '../../../core/http/api-error';
import { Avocat, DemandeRevue, DocumentJuridiqueResume, STATUTS_JURIDIQUES, TYPES_JURIDIQUES, nomAvocat } from '../models/avocat.models';
import { AvocatApiService } from '../services/avocat-api.service';

/**
 * « Demander un avocat » : choix d'un document juridique de l'entrepreneur et question à l'avocat.
 * La demande arrive « En attente » chez l'avocat choisi, qui l'accepte ou la refuse.
 */
@Component({
  selector: 'app-demande-avocat-modal',
  imports: [FormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'fermer()' },
  template: `
    <div class="fond" (click)="fermer()"></div>
    <form class="fenetre" role="dialog" aria-modal="true" aria-labelledby="titre-demande-avocat" (ngSubmit)="envoyer()" novalidate>
      <header>
        <h2 id="titre-demande-avocat">Demander {{ nom() }}</h2>
        <p>Choisissez le document à faire revoir et posez votre question. {{ nom() }} pourra accepter ou refuser votre demande.</p>
      </header>

      <fieldset>
        <legend>Document <em aria-hidden="true">*</em></legend>
        @if (chargement()) {
          <p class="discret">Chargement de vos documents…</p>
        } @else if (!documents().length) {
          <div class="aucun">
            <p>Vous n'avez aucun document juridique à faire revoir.</p>
            <a routerLink="/juridique/nouveau" (click)="annuler.emit()">Créer un document dans Juridique →</a>
          </div>
        } @else {
          <ul class="documents">
            @for (d of documents(); track d.id) {
              <li>
                <label class="document" [class.choisi]="choisi()?.id === d.id">
                  <input type="radio" name="document" [value]="d.id" [checked]="choisi()?.id === d.id" (change)="choisir(d)" />
                  <span class="texte">
                    <strong>{{ d.titre }}</strong>
                    <small>{{ type(d.type) }} · {{ statut(d.statut) }} · v{{ d.version }}</small>
                  </span>
                </label>
              </li>
            }
          </ul>
          @if (erreurs()['document']; as e) { <small class="erreur">{{ e }}</small> }
          @if (choisi()?.statut === 'BROUILLON') {
            <p class="note">Ce brouillon sera envoyé en validation : l'avocat pourra en corriger les clauses.</p>
          }
        }
      </fieldset>

      <label class="champ">
        <span>Question <em aria-hidden="true">*</em></span>
        <textarea name="question" [(ngModel)]="question" (ngModelChange)="effacer('question')" rows="4" maxlength="2000"
          placeholder="Ex. : la clause de non-concurrence est-elle valable pour une durée de 24 mois ?"
          [attr.aria-invalid]="!!erreurs()['question']"></textarea>
        @if (erreurs()['question']; as e) { <small class="erreur">{{ e }}</small> }
      </label>

      @if (erreurGenerale()) {
        <p class="alerte" role="alert">{{ erreurGenerale() }}</p>
      }

      <div class="boutons">
        <button type="button" class="secondaire" (click)="fermer()" [disabled]="envoi()">Annuler</button>
        <button type="submit" class="primaire" [disabled]="envoi() || !documents().length">{{ envoi() ? 'Envoi…' : 'Envoyer la demande' }}</button>
      </div>
    </form>
  `,
  styles: `
    :host {
      position: fixed;
      inset: 0;
      z-index: 110;
      display: flex;
      align-items: flex-start;
      justify-content: center;
      padding: 60px 16px 16px;
      overflow-y: auto;
    }
    .fond {
      position: fixed;
      inset: 0;
      background: rgba(29, 43, 47, 0.55);
    }
    .fenetre {
      position: relative;
      width: 560px;
      max-width: 100%;
      background: #ffffff;
      border-radius: 16px;
      box-shadow: 0 24px 60px rgba(10, 25, 30, 0.3);
      padding: 24px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    h2 {
      margin: 0 0 6px;
      font-size: 18px;
      font-weight: 600;
    }
    header p,
    .discret {
      margin: 0;
      font-size: 13px;
      line-height: 1.5;
      color: #5a6a6f;
    }
    fieldset {
      margin: 0;
      padding: 0;
      border: 0;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    legend,
    .champ > span {
      margin-bottom: 6px;
      font-size: 13px;
      font-weight: 500;
      color: #3d5257;
    }
    em {
      color: #b23a3a;
      font-style: normal;
    }
    .documents {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 8px;
      max-height: 240px;
      overflow-y: auto;
    }
    .document {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 14px;
      border: 1px solid #e3e8ea;
      border-radius: 12px;
      cursor: pointer;
    }
    .document:hover {
      border-color: #a9c9ce;
    }
    .document.choisi {
      border-color: #2b7a86;
      background: #f8fafa;
      box-shadow: 0 0 0 3px rgba(43, 122, 134, 0.12);
    }
    .document input {
      accent-color: #2b7a86;
      width: 18px;
      height: 18px;
    }
    .texte {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }
    .texte strong {
      font-size: 14px;
      font-weight: 600;
    }
    .texte small {
      font-size: 12px;
      color: #5a6a6f;
    }
    .aucun {
      padding: 14px;
      border-radius: 12px;
      background: #f6f8f9;
      font-size: 13px;
    }
    .aucun p {
      margin: 0 0 6px;
      color: #3d5257;
    }
    .aucun a {
      color: #1f6470;
      font-weight: 600;
      text-decoration: none;
    }
    .note {
      margin: 0;
      font-size: 12px;
      color: #9a5b07;
    }
    .champ {
      display: flex;
      flex-direction: column;
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
    [aria-invalid='true'] {
      border-color: #b23a3a;
    }
    .erreur {
      margin-top: 4px;
      font-size: 12px;
      color: #b23a3a;
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
    button {
      min-height: 44px;
      padding: 0 18px;
      border-radius: 10px;
      font-size: 14px;
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
  `,
})
export class DemandeAvocatModalComponent implements OnInit {
  private readonly api = inject(AvocatApiService);

  readonly avocat = input.required<Avocat>();
  readonly envoyee = output<DemandeRevue>();
  readonly annuler = output<void>();

  protected readonly documents = signal<DocumentJuridiqueResume[]>([]);
  protected readonly chargement = signal(true);
  protected readonly choisi = signal<DocumentJuridiqueResume | null>(null);
  protected question = '';
  protected readonly envoi = signal(false);
  protected readonly erreurs = signal<Record<string, string>>({});
  protected readonly erreurGenerale = signal<string | null>(null);

  protected nom(): string {
    return nomAvocat(this.avocat());
  }
  protected type(t: string): string {
    return TYPES_JURIDIQUES[t] ?? t;
  }
  protected statut(s: string): string {
    return STATUTS_JURIDIQUES[s] ?? s;
  }

  ngOnInit(): void {
    this.api.mesDocuments().subscribe({
      next: (docs) => {
        this.documents.set(docs.filter((d) => !d.isArchived));
        this.chargement.set(false);
      },
      error: () => {
        this.erreurGenerale.set('Impossible de charger vos documents juridiques.');
        this.chargement.set(false);
      },
    });
  }

  protected choisir(d: DocumentJuridiqueResume): void {
    this.choisi.set(d);
    this.effacer('document');
  }

  protected effacer(cle: string): void {
    if (!this.erreurs()[cle]) return;
    const { [cle]: _, ...autres } = this.erreurs();
    this.erreurs.set(autres);
  }

  protected fermer(): void {
    if (!this.envoi()) this.annuler.emit();
  }

  protected envoyer(): void {
    const document = this.choisi();
    const question = this.question.trim();
    const erreurs: Record<string, string> = {};
    if (!document) erreurs['document'] = 'Choisissez le document à faire revoir.';
    if (!question) erreurs['question'] = "Écrivez votre question à l'avocat.";
    this.erreurs.set(erreurs);
    this.erreurGenerale.set(null);
    if (!document || !question) return;

    this.envoi.set(true);
    this.api.demanderAvocat(this.avocat().username, document, question).subscribe({
      next: (demande) => {
        this.envoi.set(false);
        this.envoyee.emit(demande);
      },
      error: (e: unknown) => {
        this.envoi.set(false);
        this.erreurGenerale.set(e instanceof ApiError ? e.message : "La demande n'a pas pu être envoyée. Réessayez.");
      },
    });
  }
}
