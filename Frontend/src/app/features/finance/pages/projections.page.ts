import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { NotificationService } from '../../../core/notifications/notification.service';
import { EmptyStateComponent } from '../../../shared/components/empty-state.component';
import { GraphiqueProjectionsComponent } from '../components/graphique-projections.component';
import { MontantPipe } from '../pipes/montant.pipe';
import { erreursChamps, texteErreur } from '../services/erreurs';
import { FinanceApiService } from '../services/finance-api.service';
import { FinanceStore } from '../services/finance-store.service';

/** Projections pluriannuelles de la prévision courante (scénario 2) : les nouvelles remplacent les anciennes. */
@Component({
  selector: 'app-finance-projections',
  imports: [FormsModule, RouterLink, MontantPipe, EmptyStateComponent, GraphiqueProjectionsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      @if (store.prevision(); as p) {
        <div class="colonnes">
          <section class="principale carte">
            <div>
              <h2>Projections de la prévision {{ p.periode }}</h2>
              <span class="sous-titre">Point de départ : chiffre d'affaires {{ p.chiffreAffaires | montant: true }}, dépenses {{ p.depenses | montant: true }}</span>
            </div>
            @if (p.projections.length) {
              <app-graphique-projections [projections]="p.projections" />
              <div class="tableau-conteneur">
                <table>
                  <thead>
                    <tr>
                      <th>Année</th>
                      <th class="num">Chiffre d'affaires</th>
                      <th class="num">Dépenses</th>
                      <th class="num">Marge</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (proj of p.projections; track proj.annee) {
                      <tr>
                        <td>Année {{ proj.annee }}</td>
                        <td class="num">{{ proj.chiffreAffaires | montant: true }}</td>
                        <td class="num">{{ proj.depenses | montant: true }}</td>
                        <td class="num" [class.positif]="proj.marge > 0" [class.negatif]="proj.marge < 0">{{ proj.marge | montant: true }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            } @else {
              <app-empty-state [compact]="true" titre="Aucune projection"
                texte="Choisissez des taux d'évolution et un horizon, puis générez les projections." />
            }
          </section>

          @if (store.peutEcrire()) {
          <form class="carte formulaire" (ngSubmit)="generer(p.previsionId)" novalidate aria-label="Générer des projections">
            <h2>Générer des projections</h2>
            @if (p.validation.statut !== 'EN_ATTENTE') {
              <span class="note">Nouvelles projections = nouvel avis du financier : la prévision repassera en attente.</span>
            }
            <label class="champ" [class.en-erreur]="erreur('tauxCa')">
              Évolution annuelle du CA (%)
              <input name="tauxCa" type="number" step="0.1" [(ngModel)]="tauxCa" required />
              @if (erreur('tauxCa'); as m) {<span class="erreur-champ">{{ m }}</span>}
            </label>
            <label class="champ" [class.en-erreur]="erreur('tauxDepenses')">
              Évolution annuelle des dépenses (%)
              <input name="tauxDepenses" type="number" step="0.1" [(ngModel)]="tauxDepenses" required />
              @if (erreur('tauxDepenses'); as m) {<span class="erreur-champ">{{ m }}</span>}
            </label>
            <label class="champ" [class.en-erreur]="erreur('horizon')">
              Horizon (années)
              <input name="horizon" type="number" min="1" max="10" step="1" [(ngModel)]="horizon" required />
              <span class="aide">Entre 1 et 10 ans.</span>
              @if (erreur('horizon'); as m) {<span class="erreur-champ">{{ m }}</span>}
            </label>
            @if (messageGlobal(); as m) {
              <div class="bandeau-erreur" role="alert">{{ m }}</div>
            }
            <button type="submit" class="btn-primaire" [disabled]="enCours()">
              {{ enCours() ? 'Calcul…' : p.projections.length ? 'Remplacer les projections' : 'Générer' }}
            </button>
          </form>
          }
        </div>
      } @else if (store.peutEcrire()) {
        <app-empty-state titre="Aucune prévision" texte="Les projections partent d'une prévision.">
          <a class="btn-primaire" routerLink="../previsions">Créer une prévision</a>
        </app-empty-state>
      } @else {
        <app-empty-state titre="Aucune prévision" texte="L'entrepreneur n'a pas encore saisi de prévision pour ce projet." />
      }
    </div>
  `,
  styles: `
    .formulaire {
      flex: 1 1 300px;
      max-width: 380px;
    }
  `,
})
export class ProjectionsPage {
  protected readonly store = inject(FinanceStore);
  private readonly api = inject(FinanceApiService);
  private readonly notifications = inject(NotificationService);

  protected tauxCa: number | null = 10;
  protected tauxDepenses: number | null = 5;
  protected horizon: number | null = 5;

  protected readonly enCours = signal(false);
  protected readonly champs = signal<Record<string, string[]>>({});
  protected readonly messageGlobal = signal<string | null>(null);

  protected erreur(champ: string): string | null {
    return this.champs()[champ]?.join(' ') ?? null;
  }

  protected generer(previsionId: string): void {
    this.champs.set({});
    this.messageGlobal.set(null);
    const prevision = this.store.prevision();
    if (!prevision || this.tauxCa === null || this.tauxDepenses === null || this.horizon === null) {
      this.messageGlobal.set('Renseignez les deux taux et l’horizon.');
      return;
    }
    this.enCours.set(true);
    this.api
      .genererProjections(previsionId, { tauxCa: this.tauxCa, tauxDepenses: this.tauxDepenses, horizon: this.horizon })
      .subscribe({
        next: (projections) => {
          // De nouveaux chiffres annulent l'avis du financier : la prévision repasse en attente (comme côté backend).
          this.store.remplacer({
            ...prevision,
            projections,
            validation: { statut: 'EN_ATTENTE', commentaire: null, auteur: null, le: null },
          });
          this.notifications.succes(`${projections.length} projection(s) générée(s).`);
          this.enCours.set(false);
        },
        error: (e: unknown) => {
          this.champs.set(erreursChamps(e));
          this.messageGlobal.set(texteErreur(e));
          this.enCours.set(false);
        },
      });
  }
}
