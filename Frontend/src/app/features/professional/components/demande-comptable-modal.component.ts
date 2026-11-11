import { ChangeDetectionStrategy, Component, ElementRef, OnInit, inject, input, output, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ApiError } from '../../../core/http/api-error';
import { DossierComptable, EspaceComptable } from '../models/comptabilite.models';
import { ComptabiliteApiService } from '../services/comptabilite-api.service';

/**
 * Demande de dossier au comptable choisi : nom de la startup, identifiant du projet (facultatif)
 * et message.
 */
@Component({
  selector: 'app-demande-comptable-modal',
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'fermer()' },
  template: `
    <div class="fond" (click)="fermer()"></div>
    <form class="fenetre" role="dialog" aria-modal="true" aria-labelledby="titre-demande" (ngSubmit)="envoyer()" novalidate>
      <header>
        <h2 id="titre-demande">Demander {{ comptable().displayName }}</h2>
        <p>Votre demande lui sera envoyée ; vous serez notifié dès qu'il l'aura acceptée ou refusée.</p>
      </header>

      <label class="champ">
        <span>Nom de la startup <em aria-hidden="true">*</em></span>
        <input #champNom name="startupName" [(ngModel)]="startupName" maxlength="150" required
          autocomplete="organization" [attr.aria-invalid]="!!erreurs()['startupName']"
          aria-describedby="erreur-nom" />
        @if (erreurs()['startupName']; as e) {
          <small id="erreur-nom" class="erreur">{{ e }}</small>
        }
      </label>

      <label class="champ">
        <span>Identifiant du projet</span>
        <input name="startupId" [(ngModel)]="startupId" maxlength="64" placeholder="Facultatif"
          [attr.aria-invalid]="!!erreurs()['startupId']" aria-describedby="erreur-id" />
        @if (erreurs()['startupId']; as e) {
          <small id="erreur-id" class="erreur">{{ e }}</small>
        }
      </label>

      <label class="champ">
        <span>Message</span>
        <textarea name="requestMessage" [(ngModel)]="requestMessage" rows="4" maxlength="2000"
          placeholder="Présentez votre startup et vos besoins (tenue comptable, déclarations, bilan…)"></textarea>
        <small class="compteur">{{ requestMessage.length }} / 2000</small>
      </label>

      @if (erreurGenerale()) {
        <p class="alerte" role="alert">{{ erreurGenerale() }}</p>
      }

      <div class="boutons">
        <button type="button" class="secondaire" (click)="fermer()" [disabled]="envoi()">Annuler</button>
        <button type="submit" class="primaire" [disabled]="envoi()">{{ envoi() ? 'Envoi…' : 'Envoyer la demande' }}</button>
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
      padding: 80px 16px 16px;
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
      gap: 16px;
    }
    h2 {
      margin: 0 0 6px;
      font-size: 18px;
      font-weight: 600;
    }
    header p {
      margin: 0;
      font-size: 13px;
      line-height: 1.5;
      color: #5a6a6f;
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
    input,
    select,
    textarea {
      min-height: 44px;
      padding: 10px 12px;
      border: 1px solid #cfd8db;
      border-radius: 10px;
      background: #ffffff;
      color: #1d2b2f;
      font-weight: 400;
    }
    textarea {
      resize: vertical;
    }
    input:focus,
    select:focus,
    textarea:focus {
      outline: none;
      border-color: #2b7a86;
      box-shadow: 0 0 0 3px rgba(43, 122, 134, 0.18);
    }
    [aria-invalid='true'] {
      border-color: #b23a3a;
    }
    .erreur {
      color: #b23a3a;
      font-weight: 400;
    }
    .compteur {
      align-self: flex-end;
      color: #5a6a6f;
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
  `,
})
export class DemandeComptableModalComponent implements OnInit {
  private readonly api = inject(ComptabiliteApiService);
  private readonly champNom = viewChild<ElementRef<HTMLInputElement>>('champNom');

  readonly comptable = input.required<EspaceComptable>();
  readonly envoyee = output<DossierComptable>();
  readonly annuler = output<void>();

  protected startupName = '';
  protected startupId = '';
  protected requestMessage = '';
  protected readonly envoi = signal(false);
  protected readonly erreurs = signal<Record<string, string>>({});
  protected readonly erreurGenerale = signal<string | null>(null);

  ngOnInit(): void {
    setTimeout(() => this.champNom()?.nativeElement.focus());
  }

  protected fermer(): void {
    if (!this.envoi()) this.annuler.emit();
  }

  protected envoyer(): void {
    const nom = this.startupName.trim();
    this.erreurGenerale.set(null);
    if (!nom) {
      this.erreurs.set({ startupName: 'Indiquez le nom de votre startup.' });
      this.champNom()?.nativeElement.focus();
      return;
    }
    this.erreurs.set({});
    this.envoi.set(true);
    this.api
      .demanderDossier({
        workspaceId: this.comptable().id,
        startupName: nom,
        startupId: this.startupId.trim() || null,
        requestMessage: this.requestMessage.trim() || null,
      })
      .subscribe({
        next: (dossier) => {
          this.envoi.set(false);
          this.envoyee.emit(dossier);
        },
        error: (e: unknown) => {
          this.envoi.set(false);
          if (e instanceof ApiError) {
            this.erreurs.set(Object.fromEntries(Object.entries(e.erreursChamps).map(([k, v]) => [k, v.join(' ')])));
            this.erreurGenerale.set(e.message);
          } else {
            this.erreurGenerale.set("La demande n'a pas pu être envoyée. Réessayez.");
          }
        },
      });
  }
}
