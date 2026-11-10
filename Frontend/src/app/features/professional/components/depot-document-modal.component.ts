import { ChangeDetectionStrategy, Component, ElementRef, OnInit, inject, input, output, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ApiError } from '../../../core/http/api-error';
import {
  DocumentComptable,
  FICHIERS_ACCEPTES,
  TAILLE_MAX_OCTETS,
  TYPES_DOCUMENT,
  TypeDocument,
} from '../models/comptabilite.models';
import { ComptabiliteApiService } from '../services/comptabilite-api.service';

/**
 * Dépôt d'un fichier dans un dossier (multipart : file, title, type, periodStart, periodEnd).
 * Avec `precedent`, dépose une nouvelle version d'un document rejeté (champs pré-remplis).
 */
@Component({
  selector: 'app-depot-document-modal',
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'fermer()' },
  template: `
    <div class="fond" (click)="fermer()"></div>
    <form class="fenetre" role="dialog" aria-modal="true" aria-labelledby="titre-depot" (ngSubmit)="envoyer()" novalidate>
      <header>
        <h2 id="titre-depot">{{ precedent() ? 'Nouvelle version' : 'Déposer un document' }}</h2>
        @if (precedent(); as p) {
          <p>Remplace « {{ p.title }} » (v{{ p.versionNumber }}), rejeté par le comptable.</p>
        }
      </header>

      <label class="champ">
        <span>Titre <em aria-hidden="true">*</em></span>
        <input #champTitre name="title" [(ngModel)]="titre" maxlength="200" [attr.aria-invalid]="!!erreurs()['title']" />
        @if (erreurs()['title']; as e) { <small class="erreur">{{ e }}</small> }
      </label>

      <label class="champ">
        <span>Type <em aria-hidden="true">*</em></span>
        <select name="type" [(ngModel)]="type" [attr.aria-invalid]="!!erreurs()['type']">
          @for (t of types; track t.type) {
            <option [ngValue]="t.type">{{ t.libelle }}</option>
          }
        </select>
        @if (erreurs()['type']; as e) { <small class="erreur">{{ e }}</small> }
      </label>

      <div class="ligne">
        <label class="champ">
          <span>Début de période</span>
          <input type="date" name="periodStart" [(ngModel)]="debut" />
        </label>
        <label class="champ">
          <span>Fin de période</span>
          <input type="date" name="periodEnd" [(ngModel)]="fin" [attr.aria-invalid]="!!erreurs()['periodEnd']" />
        </label>
      </div>
      @if (erreurs()['periodEnd']; as e) { <small class="erreur">{{ e }}</small> }

      <label class="fichier" [class.rempli]="fichier()" [attr.aria-invalid]="!!erreurs()['file']">
        <input type="file" [accept]="accepte" (change)="choisirFichier($event)" />
        @if (fichier(); as f) {
          <strong>{{ f.name }}</strong>
          <span>{{ taille(f.size) }} · cliquez pour changer</span>
        } @else {
          <strong>Choisir un fichier</strong>
          <span>PDF, PNG, JPG ou XLSX · 10 Mo maximum</span>
        }
      </label>
      @if (erreurs()['file']; as e) { <small class="erreur">{{ e }}</small> }

      @if (erreurGenerale()) {
        <p class="alerte" role="alert">{{ erreurGenerale() }}</p>
      }

      <div class="boutons">
        <button type="button" class="secondaire" (click)="fermer()" [disabled]="envoi()">Annuler</button>
        <button type="submit" class="primaire" [disabled]="envoi()">{{ envoi() ? 'Envoi…' : 'Déposer' }}</button>
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
      width: 520px;
      max-width: 100%;
      background: #ffffff;
      border-radius: 16px;
      box-shadow: 0 24px 60px rgba(10, 25, 30, 0.3);
      padding: 24px;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    h2 {
      margin: 0 0 6px;
      font-size: 18px;
      font-weight: 600;
    }
    header p {
      margin: 0;
      font-size: 13px;
      color: #5a6a6f;
    }
    .ligne {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }
    .champ {
      display: flex;
      flex-direction: column;
      gap: 6px;
      font-size: 13px;
      font-weight: 500;
      color: #3d5257;
    }
    em {
      color: #b23a3a;
      font-style: normal;
    }
    input:not([type='file']),
    select {
      min-height: 44px;
      padding: 0 12px;
      border: 1px solid #cfd8db;
      border-radius: 10px;
      background: #ffffff;
      color: #1d2b2f;
      font-weight: 400;
    }
    input:focus,
    select:focus {
      outline: none;
      border-color: #2b7a86;
      box-shadow: 0 0 0 3px rgba(43, 122, 134, 0.18);
    }
    [aria-invalid='true'] {
      border-color: #b23a3a !important;
    }
    .fichier {
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      padding: 22px 16px;
      border: 1.5px dashed #a9c9ce;
      border-radius: 12px;
      background: #f8fafa;
      text-align: center;
      cursor: pointer;
      font-size: 13px;
      color: #5a6a6f;
    }
    .fichier:hover,
    .fichier:focus-within {
      border-color: #2b7a86;
      background: #e3f0f1;
    }
    .fichier.rempli {
      border-style: solid;
    }
    .fichier strong {
      color: #1f6470;
      font-size: 14px;
      word-break: break-all;
    }
    .fichier input {
      position: absolute;
      inset: 0;
      opacity: 0;
      cursor: pointer;
    }
    .erreur {
      color: #b23a3a;
      font-size: 12px;
      font-weight: 400;
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
    .primaire:hover:not(:disabled) {
      background: #1f6470;
    }
    @media (max-width: 480px) {
      .ligne {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class DepotDocumentModalComponent implements OnInit {
  private readonly api = inject(ComptabiliteApiService);
  private readonly champTitre = viewChild<ElementRef<HTMLInputElement>>('champTitre');

  readonly dossierId = input.required<string>();
  readonly precedent = input<DocumentComptable | null>(null);
  readonly depose = output<DocumentComptable>();
  readonly annuler = output<void>();

  protected readonly types = TYPES_DOCUMENT;
  protected readonly accepte = FICHIERS_ACCEPTES;
  protected titre = '';
  protected type: TypeDocument = 'INVOICE';
  protected debut = '';
  protected fin = '';
  protected readonly fichier = signal<File | null>(null);
  protected readonly envoi = signal(false);
  protected readonly erreurs = signal<Record<string, string>>({});
  protected readonly erreurGenerale = signal<string | null>(null);

  ngOnInit(): void {
    const p = this.precedent();
    if (p) {
      this.titre = p.title;
      this.type = p.type;
      this.debut = p.periodStart ?? '';
      this.fin = p.periodEnd ?? '';
    }
    setTimeout(() => this.champTitre()?.nativeElement.focus());
  }

  protected choisirFichier(evenement: Event): void {
    const f = (evenement.target as HTMLInputElement).files?.[0] ?? null;
    this.fichier.set(f);
    const { file: _, ...autres } = this.erreurs();
    this.erreurs.set(autres);
  }

  protected taille(octets: number): string {
    return octets < 1024 * 1024 ? `${Math.max(1, Math.round(octets / 1024))} Ko` : `${(octets / 1024 / 1024).toFixed(1)} Mo`;
  }

  protected fermer(): void {
    if (!this.envoi()) this.annuler.emit();
  }

  protected envoyer(): void {
    const erreurs: Record<string, string> = {};
    const titre = this.titre.trim();
    const fichier = this.fichier();
    if (!titre) erreurs['title'] = 'Indiquez un titre.';
    if (!fichier) erreurs['file'] = 'Choisissez un fichier.';
    else if (fichier.size > TAILLE_MAX_OCTETS) erreurs['file'] = 'Le fichier dépasse 10 Mo.';
    if (this.debut && this.fin && this.fin < this.debut) erreurs['periodEnd'] = 'La fin de période doit suivre le début.';
    this.erreurs.set(erreurs);
    this.erreurGenerale.set(null);
    if (Object.keys(erreurs).length || !fichier) return;

    this.envoi.set(true);
    const depot = { title: titre, type: this.type, periodStart: this.debut || null, periodEnd: this.fin || null };
    const p = this.precedent();
    const appel = p ? this.api.nouvelleVersion(p.id, depot, fichier) : this.api.deposerDocument(this.dossierId(), depot, fichier);
    appel.subscribe({
      next: (doc) => {
        this.envoi.set(false);
        this.depose.emit(doc);
      },
      error: (e: unknown) => {
        this.envoi.set(false);
        if (e instanceof ApiError) {
          this.erreurs.set(Object.fromEntries(Object.entries(e.erreursChamps).map(([k, v]) => [k, v.join(' ')])));
          this.erreurGenerale.set(e.message);
        } else {
          this.erreurGenerale.set("Le document n'a pas pu être déposé. Réessayez.");
        }
      },
    });
  }
}
