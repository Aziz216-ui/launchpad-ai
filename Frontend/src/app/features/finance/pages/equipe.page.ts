import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { NotificationService } from '../../../core/notifications/notification.service';
import { ConfirmModalComponent } from '../../../shared/components/confirm-modal.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state.component';
import { LoaderComponent } from '../../../shared/components/loader.component';
import { MembreProjet } from '../models/finance.models';
import { erreursChamps, messageErreur, texteErreur } from '../services/erreurs';
import { FinanceApiService } from '../services/finance-api.service';
import { FinanceStore } from '../services/finance-store.service';

/**
 * Équipe financière du projet : le propriétaire invite des financiers (par l'e-mail de leur compte FINANCIER)
 * qui pourront relire, valider les prévisions et certifier les documents, sans rien modifier.
 */
@Component({
  selector: 'app-finance-equipe',
  imports: [FormsModule, DatePipe, ConfirmModalComponent, EmptyStateComponent, LoaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="colonnes">
        <section class="principale">
          @if (chargement()) {
            <app-loader />
          } @else if (financiers().length) {
            <div class="tableau-conteneur">
              <table>
                <thead>
                  <tr>
                    <th>Financier invité</th>
                    <th>Invité le</th>
                    <th><span class="sr-only">Action</span></th>
                  </tr>
                </thead>
                <tbody>
                  @for (f of financiers(); track f.email) {
                    <tr>
                      <td><strong>{{ f.email }}</strong></td>
                      <td>{{ f.ajouteLe | date: 'd MMM y' }}</td>
                      <td>
                        @if (store.peutEcrire()) {
                          <button type="button" class="btn-texte danger" (click)="aRetirer.set(f)">Retirer</button>
                        }
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          } @else {
            <app-empty-state titre="Aucun financier invité"
              texte="Invitez un conseiller financier : il relira vos prévisions, donnera son avis et certifiera vos documents avant leur envoi à un investisseur." />
          }
        </section>

        @if (store.peutEcrire()) {
          <form class="carte formulaire" (ngSubmit)="inviter()" novalidate aria-label="Inviter un financier">
            <h2>Inviter un financier</h2>
            <label class="champ" [class.en-erreur]="erreurEmail()">
              E-mail de son compte
              <input name="email" type="email" maxlength="320" [(ngModel)]="email" placeholder="conseil@exemple.tn"
                autocomplete="off" required />
              <span class="aide">Le compte doit avoir le rôle « Financier ». Il verra ce projet dès sa prochaine connexion.</span>
              @if (erreurEmail(); as m) {<span class="erreur-champ">{{ m }}</span>}
            </label>
            <button type="submit" class="btn-primaire" [disabled]="enCours()">
              {{ enCours() ? 'Invitation…' : 'Inviter' }}
            </button>
            <span class="note">Le financier a un accès en lecture seule : il ne peut ni saisir ni supprimer.</span>
          </form>
        }
      </div>
    </div>

    @if (aRetirer(); as f) {
      <app-confirm-modal titre="Retirer ce financier ?" avant="" [nom]="f.email" libelleConfirmer="Retirer"
        apres=" n'aura plus accès aux prévisions ni aux documents de ce projet." [enCours]="retraitEnCours()"
        (confirmer)="retirer(f)" (annuler)="aRetirer.set(null)" />
    }
  `,
  styles: `
    .formulaire {
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
export class EquipePage {
  protected readonly store = inject(FinanceStore);
  private readonly api = inject(FinanceApiService);
  private readonly notifications = inject(NotificationService);

  protected readonly financiers = signal<MembreProjet[]>([]);
  protected readonly chargement = signal(false);
  protected readonly enCours = signal(false);
  protected readonly erreurEmail = signal<string | null>(null);
  protected readonly aRetirer = signal<MembreProjet | null>(null);
  protected readonly retraitEnCours = signal(false);

  protected email = '';

  constructor() {
    effect(() => {
      const projetId = this.store.projetId();
      untracked(() => this.charger(projetId));
    });
  }

  private charger(projetId: number): void {
    this.chargement.set(true);
    this.api.listerFinanciers(projetId).subscribe({
      next: (liste) => {
        this.financiers.set(liste);
        this.chargement.set(false);
      },
      error: (e: unknown) => {
        this.financiers.set([]);
        this.chargement.set(false);
        messageErreur(e, this.notifications);
      },
    });
  }

  protected inviter(): void {
    this.erreurEmail.set(null);
    const email = this.email.trim();
    if (!email) {
      this.erreurEmail.set('Renseignez l’e-mail du financier.');
      return;
    }
    this.enCours.set(true);
    this.api.inviterFinancier(this.store.projetId(), email).subscribe({
      next: (membre) => {
        this.financiers.update((liste) =>
          liste.some((f) => f.email === membre.email) ? liste : [...liste, membre],
        );
        this.email = '';
        this.enCours.set(false);
        this.notifications.succes(`${membre.email} est invité sur le projet.`);
        // Une invitation sur un projet libre en fait le propriétaire.
        this.store.rechargerDroits();
        this.store.rafraichirMesProjets();
      },
      error: (e: unknown) => {
        this.erreurEmail.set(erreursChamps(e)['email']?.join(' ') ?? texteErreur(e));
        this.enCours.set(false);
      },
    });
  }

  protected retirer(membre: MembreProjet): void {
    this.retraitEnCours.set(true);
    this.api.retirerFinancier(this.store.projetId(), membre.email).subscribe({
      next: () => {
        this.financiers.update((liste) => liste.filter((f) => f.email !== membre.email));
        this.aRetirer.set(null);
        this.retraitEnCours.set(false);
        this.notifications.succes(`${membre.email} n'a plus accès au projet.`);
      },
      error: (e: unknown) => {
        messageErreur(e, this.notifications);
        this.retraitEnCours.set(false);
      },
    });
  }
}
