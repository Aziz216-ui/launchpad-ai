import { ChangeDetectionStrategy, Component, ElementRef, OnInit, input, output, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';

/**
 * Confirmation d'une action, avec un commentaire facultatif ou obligatoire :
 * rejeter / réviser un document, refuser une demande, clôturer un dossier.
 * L'appel à l'API reste chez le parent, qui renvoie son erreur éventuelle via `erreur`.
 */
@Component({
  selector: 'app-saisie-modal',
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'fermer()' },
  template: `
    <div class="fond" (click)="fermer()"></div>
    <form class="fenetre" role="dialog" aria-modal="true" aria-labelledby="titre-saisie" (ngSubmit)="valider()" novalidate>
      <h2 id="titre-saisie">{{ titre() }}</h2>
      @if (texte()) {
        <p class="texte">{{ texte() }}</p>
      }
      @if (libelleChamp()) {
        <label class="champ">
          <span>{{ libelleChamp() }} @if (obligatoire()) {<em aria-hidden="true">*</em>}</span>
          <textarea #champ name="valeur" [(ngModel)]="valeur" rows="4" maxlength="2000"
            [placeholder]="placeholder()" [attr.aria-invalid]="!!erreurLocale()"></textarea>
        </label>
      }
      @if (erreurLocale() || erreur(); as e) {
        <p class="alerte" role="alert">{{ e }}</p>
      }
      <div class="boutons">
        <button type="button" class="secondaire" (click)="fermer()" [disabled]="enCours()">Annuler</button>
        <button type="submit" [class]="variante()" [disabled]="enCours()">{{ enCours() ? 'Patientez…' : libelleConfirmer() }}</button>
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
      padding: 100px 16px 16px;
    }
    .fond {
      position: fixed;
      inset: 0;
      background: rgba(29, 43, 47, 0.55);
    }
    .fenetre {
      position: relative;
      width: 480px;
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
      margin: 0;
      font-size: 18px;
      font-weight: 600;
    }
    .texte {
      margin: 0;
      font-size: 13px;
      line-height: 1.6;
      color: #3d5257;
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
    textarea {
      padding: 10px 12px;
      border: 1px solid #cfd8db;
      border-radius: 10px;
      color: #1d2b2f;
      font-weight: 400;
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
      border: 0;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      color: #ffffff;
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
      background: #2b7a86;
    }
    .primaire:hover:not(:disabled) {
      background: #1f6470;
    }
    .danger {
      background: #b23a3a;
    }
    .danger:hover:not(:disabled) {
      background: #8e2b2b;
    }
  `,
})
export class SaisieModalComponent implements OnInit {
  private readonly champ = viewChild<ElementRef<HTMLTextAreaElement>>('champ');

  readonly titre = input.required<string>();
  readonly texte = input('');
  /** Vide : pas de champ, simple confirmation. */
  readonly libelleChamp = input('');
  readonly placeholder = input('');
  readonly obligatoire = input(false);
  readonly libelleConfirmer = input('Confirmer');
  readonly variante = input<'primaire' | 'danger'>('primaire');
  readonly enCours = input(false);
  readonly erreur = input<string | null>(null);
  readonly confirmer = output<string>();
  readonly annuler = output<void>();

  protected valeur = '';
  protected readonly erreurLocale = signal<string | null>(null);

  ngOnInit(): void {
    setTimeout(() => this.champ()?.nativeElement.focus());
  }

  protected fermer(): void {
    if (!this.enCours()) this.annuler.emit();
  }

  protected valider(): void {
    const valeur = this.valeur.trim();
    if (this.libelleChamp() && this.obligatoire() && !valeur) {
      this.erreurLocale.set('Ce champ est obligatoire.');
      this.champ()?.nativeElement.focus();
      return;
    }
    this.erreurLocale.set(null);
    this.confirmer.emit(valeur);
  }
}
