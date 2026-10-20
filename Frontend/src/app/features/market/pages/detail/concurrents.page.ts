import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { NotificationService } from '../../../../core/notifications/notification.service';
import { ConfirmModalComponent } from '../../../../shared/components/confirm-modal.component';
import { EmptyStateComponent } from '../../../../shared/components/empty-state.component';
import { IconComponent } from '../../../../shared/components/icon.component';
import { MenuActionsComponent } from '../../components/menu-actions.component';
import { InitialesPipe, MontantPipe, PourcentagePipe } from '../../pipes/format.pipes';
import { formatMontant, formatPourcentage } from '../../utils/format';
import { messageErreur } from '../../utils/form';
import { ConcurrentModalComponent } from '../../components/concurrent-modal.component';
import { POSITIONNEMENTS } from '../../models/libelles';
import { Concurrent } from '../../models/market.models';
import { EtudeStore } from '../../services/etude-store.service';
import { MarketApiService } from '../../services/market-api.service';

/** Onglet « Concurrents » (maquette Concurrents.dc.html). */
@Component({
  selector: 'app-concurrents',
  imports: [
    RouterLink,
    ConfirmModalComponent,
    ConcurrentModalComponent,
    EmptyStateComponent,
    IconComponent,
    MenuActionsComponent,
    InitialesPipe,
    MontantPipe,
    PourcentagePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './concurrents.page.html',
  styleUrl: './concurrents.page.scss',
})
export class ConcurrentsPage {
  protected readonly store = inject(EtudeStore);
  private readonly api = inject(MarketApiService);
  private readonly notifications = inject(NotificationService);

  protected readonly concurrents = computed(() => this.store.etude()?.concurrents_details ?? []);

  protected readonly modal = signal<{ mode: 'associer' | 'modifier'; concurrent: Concurrent | null } | null>(null);
  protected readonly aSupprimer = signal<Concurrent | null>(null);
  protected readonly suppressionEnCours = signal(false);

  /** Note sous le tableau : part du marché occupée par les concurrents analysés. */
  protected readonly notePartsDeMarche = computed(() => {
    const liste = this.concurrents();
    if (!liste.length) return '';
    const total = liste.reduce((somme, c) => somme + c.part_de_marche, 0);
    const reste = Math.max(0, 100 - total);
    return `Parts de marché : ${formatPourcentage(total)} pour ces ${liste.length} acteurs, ${formatPourcentage(reste)} pour les autres.`;
  });

  /** Carte « positionnement » construite à partir de la comparaison des prix. */
  protected readonly positionnement = computed(() => {
    const c = this.store.comparaison();
    if (!c || c.prix_min === null || c.prix_max === null || c.prix_moyen === null) return null;
    const titres = {
      economique: 'Un positionnement accessible',
      aligne: 'Un positionnement aligné sur le marché',
      premium: 'Un positionnement premium',
      inconnu: 'Les prix du marché',
    };
    let texte = `De ${formatMontant(c.prix_min)} à ${formatMontant(c.prix_max)}, avec une moyenne de ${formatMontant(c.prix_moyen)}.`;
    if (c.prix_propose !== null) {
      const position =
        c.prix_propose < c.prix_moyen ? 'reste sous' : c.prix_propose > c.prix_moyen ? 'se situe au-dessus de' : 'est égale à';
      texte += ` Votre offre à ${formatMontant(c.prix_propose)} ${position} la moyenne du marché (positionnement ${POSITIONNEMENTS[c.positionnement]}).`;
    }
    return { titre: titres[c.positionnement], texte };
  });

  protected retirer(concurrent: Concurrent): void {
    const etude = this.store.etude();
    if (!etude) return;
    this.api
      .modifierEtude(etude.id, { concurrents: etude.concurrents.filter((id) => id !== concurrent.id) })
      .subscribe({
        next: () => {
          this.notifications.succes(`${concurrent.nom} a été retiré de l'étude.`);
          this.store.recharger();
        },
        error: (e: unknown) => this.notifications.erreur(messageErreur(e, 'Impossible de retirer ce concurrent.')),
      });
  }

  protected supprimer(): void {
    const concurrent = this.aSupprimer();
    if (!concurrent) return;
    this.suppressionEnCours.set(true);
    this.api.supprimerConcurrent(concurrent.id).subscribe({
      next: () => {
        this.suppressionEnCours.set(false);
        this.aSupprimer.set(null);
        this.notifications.succes(`Le concurrent ${concurrent.nom} a été supprimé.`);
        this.store.recharger();
      },
      error: (e: unknown) => {
        this.suppressionEnCours.set(false);
        this.notifications.erreur(messageErreur(e, 'Impossible de supprimer ce concurrent.'));
      },
    });
  }

  protected apresEnregistrement(): void {
    this.modal.set(null);
    this.store.recharger();
  }
}
