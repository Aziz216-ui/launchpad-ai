import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { NotificationService } from '../../../core/notifications/notification.service';
import { EmptyStateComponent } from '../../../shared/components/empty-state.component';
import { LoaderComponent } from '../../../shared/components/loader.component';
import { MontantPipe } from '../pipes/montant.pipe';
import { erreursChamps, texteErreur } from '../services/erreurs';
import { FinanceApiService } from '../services/finance-api.service';
import { FinanceStore } from '../services/finance-store.service';

/** Prévisions du projet : liste, sélection de la prévision courante et création (scénario 1). */
@Component({
  selector: 'app-finance-previsions',
  imports: [FormsModule, DatePipe, MontantPipe, EmptyStateComponent, LoaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="colonnes">
        <section class="principale">
          @if (store.chargement()) {
            <app-loader />
          } @else if (store.previsions().length) {
            <div class="tableau-conteneur">
              <table>
                <thead>
                  <tr>
                    <th>Période</th>
                    <th class="num">Chiffre d'affaires</th>
                    <th class="num">Coûts directs</th>
                    <th class="num">Dépenses</th>
                    <th class="num">Résultat</th>
                    <th>Créée le</th>
                    <th><span class="sr-only">Action</span></th>
                  </tr>
                </thead>
                <tbody>
                  @for (p of store.previsions(); track p.previsionId) {
                    <tr [class.actif]="p.previsionId === store.prevision()?.previsionId">
                      <td><strong>{{ p.periode }}</strong></td>
                      <td class="num">{{ p.chiffreAffaires | montant: true }}</td>
                      <td class="num">{{ p.coutsDirects | montant: true }}</td>
                      <td class="num">{{ p.depenses | montant: true }}</td>
                      <td class="num" [class.positif]="p.resultat > 0" [class.negatif]="p.resultat < 0">{{ p.resultat | montant: true }}</td>
                      <td>{{ p.creeLe | date: 'd MMM y' }}</td>
                      <td>
                        @if (p.previsionId === store.prevision()?.previsionId) {
                          <span class="note">Courante</span>
                        } @else {
                          <button type="button" class="btn-texte" (click)="store.choisirPrevision(p.previsionId)">Utiliser</button>
                        }
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          } @else {
            <app-empty-state titre="Aucune prévision" texte="Renseignez le formulaire pour créer votre première prévision." />
          }
        </section>

        <form class="carte laterale-formulaire" (ngSubmit)="creer()" novalidate aria-label="Nouvelle prévision">
          <h2>Nouvelle prévision</h2>
          <label class="champ" [class.en-erreur]="erreur('periode')">
            Période
            <input name="periode" [(ngModel)]="periode" maxlength="50" placeholder="2026" required />
            @if (erreur('periode'); as m) {<span class="erreur-champ">{{ m }}</span>}
          </label>
          <label class="champ" [class.en-erreur]="erreur('chiffreAffaires')">
            Chiffre d'affaires
            <input name="ca" type="number" min="0" step="0.01" [(ngModel)]="chiffreAffaires" required />
            @if (erreur('chiffreAffaires'); as m) {<span class="erreur-champ">{{ m }}</span>}
          </label>
          <label class="champ" [class.en-erreur]="erreur('coutsDirects')">
            Coûts directs
            <input name="couts" type="number" min="0" step="0.01" [(ngModel)]="coutsDirects" required />
            @if (erreur('coutsDirects'); as m) {<span class="erreur-champ">{{ m }}</span>}
          </label>
          <label class="champ" [class.en-erreur]="erreur('depenses')">
            Dépenses totales
            <input name="depenses" type="number" min="0" step="0.01" [(ngModel)]="depenses" required />
            <span class="aide">Les dépenses incluent les coûts directs.</span>
            @if (erreur('depenses'); as m) {<span class="erreur-champ">{{ m }}</span>}
          </label>
          @if (messageGlobal(); as m) {
            <div class="bandeau-erreur" role="alert">{{ m }}</div>
          }
          <button type="submit" class="btn-primaire" [disabled]="enCours()">
            {{ enCours() ? 'Enregistrement…' : 'Enregistrer la prévision' }}
          </button>
        </form>
      </div>
    </div>
  `,
  styles: `
    .laterale-formulaire {
      flex: 1 1 300px;
      max-width: 380px;
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
export class PrevisionsPage {
  protected readonly store = inject(FinanceStore);
  private readonly api = inject(FinanceApiService);
  private readonly notifications = inject(NotificationService);

  protected periode = String(new Date().getFullYear());
  protected chiffreAffaires: number | null = null;
  protected coutsDirects: number | null = null;
  protected depenses: number | null = null;

  protected readonly enCours = signal(false);
  protected readonly champs = signal<Record<string, string[]>>({});
  protected readonly messageGlobal = signal<string | null>(null);

  protected erreur(champ: string): string | null {
    return this.champs()[champ]?.join(' ') ?? null;
  }

  protected creer(): void {
    this.champs.set({});
    this.messageGlobal.set(null);
    if (this.chiffreAffaires === null || this.coutsDirects === null || this.depenses === null || !this.periode.trim()) {
      this.messageGlobal.set('Renseignez la période et les trois montants.');
      return;
    }
    this.enCours.set(true);
    this.api
      .creerPrevision({
        projetId: this.store.projetId(),
        periode: this.periode.trim(),
        chiffreAffaires: this.chiffreAffaires,
        coutsDirects: this.coutsDirects,
        depenses: this.depenses,
      })
      .subscribe({
        next: (prevision) => {
          this.store.ajouter(prevision);
          this.notifications.succes(`Prévision ${prevision.periode} enregistrée.`);
          this.chiffreAffaires = this.coutsDirects = this.depenses = null;
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
