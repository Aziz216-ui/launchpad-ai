import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { NotificationService } from '../../../core/notifications/notification.service';
import { BadgeComponent } from '../../../shared/components/badge.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state.component';
import { LoaderComponent } from '../../../shared/components/loader.component';
import { Prevision } from '../models/finance.models';
import { STATUTS_VALIDATION } from '../models/libelles';
import { MontantPipe } from '../pipes/montant.pipe';
import { erreursChamps, texteErreur } from '../services/erreurs';
import { FinanceApiService } from '../services/finance-api.service';
import { FinanceStore } from '../services/finance-store.service';

/**
 * Prévisions du projet : liste avec l'avis du financier, sélection de la prévision courante.
 * Le propriétaire crée des prévisions (scénario 1) ; le financier invité les valide ou les rejette.
 */
@Component({
  selector: 'app-finance-previsions',
  imports: [FormsModule, DatePipe, MontantPipe, BadgeComponent, EmptyStateComponent, LoaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="colonnes">
        <section class="principale">
          @if (store.chargement()) {
            <app-loader />
          } @else if (store.erreur(); as erreur) {
            <div class="bandeau-erreur" role="alert">{{ erreur }}</div>
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
                    <th>Avis</th>
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
                      <td>
                        <app-badge [variante]="statuts[p.validation.statut].variante" [petit]="true">
                          {{ statuts[p.validation.statut].libelle }}
                        </app-badge>
                      </td>
                      <td>{{ p.creeLe | date: 'd MMM y' }}</td>
                      <td>
                        @if (p.previsionId === store.prevision()?.previsionId) {
                          <span class="note">Courante</span>
                        } @else {
                          <button type="button" class="btn-texte" (click)="store.choisirPrevision(p.previsionId)">
                            {{ store.peutValider() ? 'Examiner' : 'Utiliser' }}
                          </button>
                        }
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          } @else if (store.peutEcrire()) {
            <app-empty-state titre="Aucune prévision" texte="Renseignez le formulaire pour créer votre première prévision." />
          } @else {
            <app-empty-state titre="Aucune prévision" texte="L'entrepreneur n'a pas encore saisi de prévision pour ce projet." />
          }
        </section>

        <div class="laterale-formulaire">
          @if (store.prevision(); as p) {
            <section class="carte" aria-live="polite">
              <div class="entete-carte">
                <h2>Avis sur la prévision {{ p.periode }}</h2>
                <app-badge [variante]="statuts[p.validation.statut].variante">{{ statuts[p.validation.statut].libelle }}</app-badge>
              </div>
              @if (p.validation.statut !== 'EN_ATTENTE') {
                <p class="avis">
                  @if (p.validation.commentaire) { « {{ p.validation.commentaire }} » }
                  <span class="note">{{ p.validation.auteur }}, le {{ p.validation.le | date: 'd MMM y, HH:mm' }}</span>
                </p>
              } @else if (!store.peutValider()) {
                <p class="note">Un financier invité sur le projet doit encore valider cette prévision.</p>
              }

              @if (store.peutValider()) {
                @if (p.validation.statut !== 'EN_ATTENTE') {
                  <span class="note">Vous pouvez modifier votre avis.</span>
                }
                <label class="champ" [class.en-erreur]="erreurAvis()">
                  Commentaire
                  <textarea name="commentaire" rows="3" maxlength="2000" [(ngModel)]="commentaire"
                    placeholder="Ex. : hypothèse de croissance de 40 % irréaliste"></textarea>
                  <span class="aide">Obligatoire pour un rejet.</span>
                  @if (erreurAvis(); as m) {<span class="erreur-champ">{{ m }}</span>}
                </label>
                <div class="actions-avis">
                  <button type="button" class="btn-primaire" [disabled]="avisEnCours()" (click)="donnerAvis(p, 'VALIDEE')">Valider</button>
                  <button type="button" class="btn-secondaire danger" [disabled]="avisEnCours()" (click)="donnerAvis(p, 'REJETEE')">Rejeter</button>
                </div>
              }
            </section>
          }

          @if (store.peutEcrire()) {
            <form class="carte" (ngSubmit)="creer()" novalidate aria-label="Nouvelle prévision">
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
          }
        </div>
      </div>
    </div>
  `,
  styles: `
    .laterale-formulaire {
      flex: 1 1 300px;
      max-width: 380px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .avis {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .actions-avis {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    textarea {
      font: inherit;
      resize: vertical;
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

  protected readonly statuts = STATUTS_VALIDATION;

  protected periode = String(new Date().getFullYear());
  protected chiffreAffaires: number | null = null;
  protected coutsDirects: number | null = null;
  protected depenses: number | null = null;

  protected readonly enCours = signal(false);
  protected readonly champs = signal<Record<string, string[]>>({});
  protected readonly messageGlobal = signal<string | null>(null);

  protected commentaire = '';
  protected readonly avisEnCours = signal(false);
  protected readonly erreurAvis = signal<string | null>(null);

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

  protected donnerAvis(prevision: Prevision, decision: 'VALIDEE' | 'REJETEE'): void {
    this.erreurAvis.set(null);
    const commentaire = this.commentaire.trim();
    if (decision === 'REJETEE' && !commentaire) {
      this.erreurAvis.set('Expliquez la raison du rejet à l’entrepreneur.');
      return;
    }
    this.avisEnCours.set(true);
    this.api.donnerAvis(prevision.previsionId, { decision, commentaire: commentaire || null }).subscribe({
      next: (miseAJour) => {
        this.store.remplacer(miseAJour);
        this.store.rafraichirMesProjets();
        this.commentaire = '';
        this.avisEnCours.set(false);
        this.notifications.succes(decision === 'VALIDEE' ? 'Prévision validée.' : 'Prévision rejetée.');
      },
      error: (e: unknown) => {
        this.erreurAvis.set(texteErreur(e));
        this.avisEnCours.set(false);
      },
    });
  }
}
