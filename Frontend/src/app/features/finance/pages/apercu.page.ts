import { ChangeDetectionStrategy, Component, effect, inject, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';

import { BadgeComponent } from '../../../shared/components/badge.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state.component';
import { LoaderComponent } from '../../../shared/components/loader.component';
import { NotificationService } from '../../../core/notifications/notification.service';
import { GraphiqueProjectionsComponent } from '../components/graphique-projections.component';
import { Ecart, Marges } from '../models/finance.models';
import { STATUTS_ECART } from '../models/libelles';
import { MontantPipe, TauxPipe } from '../pipes/montant.pipe';
import { messageErreur } from '../services/erreurs';
import { FinanceApiService } from '../services/finance-api.service';
import { FinanceStore } from '../services/finance-store.service';

/** Vue d'ensemble : chiffres clés de la prévision courante, projections et commentaire de l'IA. */
@Component({
  selector: 'app-finance-apercu',
  imports: [RouterLink, BadgeComponent, EmptyStateComponent, LoaderComponent, GraphiqueProjectionsComponent, MontantPipe, TauxPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      @if (store.chargement()) {
        <app-loader />
      } @else if (store.erreur(); as erreur) {
        <div class="bandeau-erreur" role="alert">{{ erreur }}</div>
      } @else if (store.prevision(); as p) {
        <div class="grille-kpi">
          <div class="kpi">
            <span class="libelle">Chiffre d'affaires</span>
            <span class="valeur">{{ p.chiffreAffaires | montant: true }}</span>
            <span class="detail">Période {{ p.periode }}</span>
          </div>
          <div class="kpi">
            <span class="libelle">Dépenses</span>
            <span class="valeur">{{ p.depenses | montant: true }}</span>
            <span class="detail">dont {{ p.coutsDirects | montant: true }} de coûts directs</span>
          </div>
          <div class="kpi">
            <span class="libelle">Résultat</span>
            <span class="valeur" [class.positif]="p.resultat > 0" [class.negatif]="p.resultat < 0">{{ p.resultat | montant: true }}</span>
            <span class="detail">Chiffre d'affaires − dépenses</span>
          </div>
          <div class="kpi">
            <span class="libelle">Marge brute</span>
            <span class="valeur">{{ marges()?.tauxMargeBrute | taux }}</span>
            <span class="detail">{{ marges()?.margeBrute | montant: true }}</span>
          </div>
          <div class="kpi">
            <span class="libelle">Marge nette</span>
            <span class="valeur">{{ marges()?.tauxMargeNette | taux }}</span>
            <span class="detail">{{ marges()?.margeNette | montant: true }}</span>
          </div>
        </div>

        <div class="colonnes">
          <section class="carte principale">
            <div class="entete-carte">
              <div>
                <h2>Projections pluriannuelles</h2>
                <span class="sous-titre">Chiffre d'affaires, dépenses et marge par année</span>
              </div>
              <a class="btn-secondaire" routerLink="../projections">Gérer les projections</a>
            </div>
            @if (p.projections.length) {
              <app-graphique-projections [projections]="p.projections" />
            } @else {
              <app-empty-state [compact]="true" titre="Aucune projection"
                texte="Générez des projections pour visualiser l'évolution sur plusieurs années." />
            }
          </section>

          <div class="laterale">
            <section class="carte">
              <div class="entete-carte">
                <h2>Écart revenus / dépenses</h2>
                @if (ecart(); as e) {
                  <app-badge [variante]="statuts[e.statut].variante">{{ statuts[e.statut].libelle }}</app-badge>
                }
              </div>
              @if (ecart(); as e) {
                <p><strong>{{ e.montant | montant: true }}</strong> soit {{ e.pourcentage | taux }} du chiffre d'affaires.</p>
              }
              <button type="button" class="btn-primaire" (click)="commenter(p.previsionId)" [disabled]="commentaireEnCours()">
                {{ commentaireEnCours() ? 'Rédaction en cours…' : "Commenter avec l'IA" }}
              </button>
            </section>
            @if (commentaire(); as texte) {
              <section class="carte-ia" aria-live="polite">
                <h3>Commentaire de l'assistant IA</h3>
                <p>{{ texte }}</p>
                <span class="note">Rédigé par IA à partir des chiffres calculés ci-dessus.</span>
              </section>
            }
          </div>
        </div>
      } @else {
        <app-empty-state titre="Aucune prévision pour ce projet"
          texte="Créez votre première prévision pour obtenir vos marges, vos écarts et vos projections.">
          <a class="btn-primaire" routerLink="../previsions">Créer une prévision</a>
        </app-empty-state>
      }
    </div>
  `,
})
export class ApercuPage {
  protected readonly store = inject(FinanceStore);
  private readonly api = inject(FinanceApiService);
  private readonly notifications = inject(NotificationService);

  protected readonly statuts = STATUTS_ECART;
  protected readonly marges = signal<Marges | null>(null);
  protected readonly ecart = signal<Ecart | null>(null);
  protected readonly commentaire = signal<string | null>(null);
  protected readonly commentaireEnCours = signal(false);

  constructor() {
    // Marges et écart sont recalculés par le backend à chaque changement de prévision courante.
    effect(() => {
      const prevision = this.store.prevision();
      untracked(() => {
        this.marges.set(null);
        this.ecart.set(null);
        this.commentaire.set(null);
        if (!prevision) return;
        this.api.consulterMarges(prevision.previsionId).subscribe({ next: (m) => this.marges.set(m), error: () => undefined });
        this.api.consulterEcart(prevision.previsionId).subscribe({ next: (e) => this.ecart.set(e), error: () => undefined });
      });
    });
  }

  protected commenter(previsionId: string): void {
    this.commentaireEnCours.set(true);
    this.api.commenterEcart(previsionId).subscribe({
      next: (r) => {
        this.commentaire.set(r.commentaire);
        this.commentaireEnCours.set(false);
      },
      error: (e: unknown) => {
        messageErreur(e, this.notifications);
        this.commentaireEnCours.set(false);
      },
    });
  }
}
