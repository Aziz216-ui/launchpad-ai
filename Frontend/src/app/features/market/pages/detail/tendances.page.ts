import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { NotificationService } from '../../../../core/notifications/notification.service';
import { BadgeComponent } from '../../../../shared/components/badge.component';
import { EmptyStateComponent } from '../../../../shared/components/empty-state.component';
import { IconComponent } from '../../../../shared/components/icon.component';
import { MenuActionsComponent } from '../../components/menu-actions.component';
import { messageErreur } from '../../utils/form';
import { TendanceModalComponent } from '../../components/tendance-modal.component';
import { IMPACTS } from '../../models/libelles';
import { Tendance } from '../../models/market.models';
import { EtudeStore } from '../../services/etude-store.service';
import { MarketApiService } from '../../services/market-api.service';

/** Onglet « Tendances » (maquette Tendances.dc.html). */
@Component({
  selector: 'app-tendances',
  imports: [RouterLink, BadgeComponent, EmptyStateComponent, IconComponent, MenuActionsComponent, TendanceModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tendances.page.html',
  styleUrl: './tendances.page.scss',
})
export class TendancesPage {
  protected readonly store = inject(EtudeStore);
  private readonly api = inject(MarketApiService);
  private readonly notifications = inject(NotificationService);

  protected readonly impacts = IMPACTS;
  protected readonly modalOuverte = signal(false);

  protected readonly tendances = computed(() => this.store.etude()?.tendances_details ?? []);

  protected readonly balance = computed(() => {
    const liste = this.tendances();
    return {
      positives: liste.filter((t) => t.impact === 'positif').length,
      negatives: liste.filter((t) => t.impact === 'negatif').length,
      neutres: liste.filter((t) => t.impact === 'neutre').length,
    };
  });

  protected retirer(tendance: Tendance): void {
    const etude = this.store.etude();
    if (!etude) return;
    this.api.modifierEtude(etude.id, { tendances: etude.tendances.filter((id) => id !== tendance.id) }).subscribe({
      next: () => {
        this.notifications.succes(`« ${tendance.titre} » a été retirée de l'étude.`);
        this.store.recharger();
      },
      error: (e: unknown) => this.notifications.erreur(messageErreur(e, 'Impossible de retirer cette tendance.')),
    });
  }

  protected apresEnregistrement(): void {
    this.modalOuverte.set(false);
    this.store.recharger();
  }
}
