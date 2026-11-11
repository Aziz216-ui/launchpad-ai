import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, input, output, signal } from '@angular/core';

import { BadgeComponent } from '../../../shared/components/badge.component';
import { LoaderComponent } from '../../../shared/components/loader.component';
import { DocumentComptable, ValidationDocument } from '../models/comptabilite.models';
import { ComptabiliteApiService } from '../services/comptabilite-api.service';

/** Historique des décisions du comptable sur un document (GET /documents/{id}/validations). */
@Component({
  selector: 'app-historique-document-modal',
  imports: [DatePipe, BadgeComponent, LoaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'fermer.emit()' },
  template: `
    <div class="fond" (click)="fermer.emit()"></div>
    <section class="fenetre" role="dialog" aria-modal="true" aria-labelledby="titre-historique">
      <header>
        <h2 id="titre-historique">Historique des décisions</h2>
        <p>{{ document().title }} · v{{ document().versionNumber }}</p>
      </header>
      @if (chargement()) {
        <app-loader texte="Chargement…" />
      } @else if (erreur()) {
        <p class="vide">{{ erreur() }}</p>
      } @else if (!validations().length) {
        <p class="vide">Aucune décision pour l'instant : le document attend la revue du comptable.</p>
      } @else {
        <ol>
          @for (v of validations(); track v.id) {
            <li>
              <div class="ligne">
                <app-badge [variante]="v.decision === 'VALIDATED' ? 'succes' : 'danger'" [petit]="true">
                  {{ v.decision === 'VALIDATED' ? 'Validé' : 'Rejeté' }}
                </app-badge>
                @if (v.revision) { <span class="note">Révision</span> }
                @if (v.automatic) { <span class="note">Automatique</span> }
                <time>{{ v.createdAt | date: 'dd/MM/y HH:mm' }}</time>
              </div>
              @if (v.comment) { <p>{{ v.comment }}</p> }
            </li>
          }
        </ol>
      }
      <div class="boutons">
        <button type="button" (click)="fermer.emit()">Fermer</button>
      </div>
    </section>
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
      width: 500px;
      max-width: 100%;
      max-height: calc(100vh - 140px);
      overflow-y: auto;
      background: #ffffff;
      border-radius: 16px;
      box-shadow: 0 24px 60px rgba(10, 25, 30, 0.3);
      padding: 24px;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    h2 {
      margin: 0 0 4px;
      font-size: 18px;
      font-weight: 600;
    }
    header p,
    .vide {
      margin: 0;
      font-size: 13px;
      color: #5a6a6f;
    }
    ol {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    li {
      padding: 12px 14px;
      border: 1px solid #e3e8ea;
      border-radius: 12px;
    }
    .ligne {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    .note {
      font-size: 12px;
      color: #5a6a6f;
    }
    time {
      margin-left: auto;
      font-size: 12px;
      color: #5a6a6f;
    }
    li p {
      margin: 8px 0 0;
      font-size: 13px;
      line-height: 1.5;
      color: #3d5257;
    }
    .boutons {
      display: flex;
      justify-content: flex-end;
    }
    button {
      min-height: 44px;
      padding: 0 18px;
      border: 1px solid #cfd8db;
      border-radius: 10px;
      background: #ffffff;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
    }
  `,
})
export class HistoriqueDocumentModalComponent implements OnInit {
  private readonly api = inject(ComptabiliteApiService);

  readonly document = input.required<DocumentComptable>();
  readonly fermer = output<void>();

  protected readonly validations = signal<ValidationDocument[]>([]);
  protected readonly chargement = signal(true);
  protected readonly erreur = signal<string | null>(null);

  ngOnInit(): void {
    this.api.validations(this.document().id).subscribe({
      next: (v) => {
        this.validations.set(v);
        this.chargement.set(false);
      },
      error: () => {
        this.erreur.set("Impossible de charger l'historique.");
        this.chargement.set(false);
      },
    });
  }
}
