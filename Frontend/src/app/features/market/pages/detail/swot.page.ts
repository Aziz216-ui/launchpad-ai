import { formatDate } from '@angular/common';
import { ChangeDetectionStrategy, Component, LOCALE_ID, computed, inject, signal } from '@angular/core';

import { NotificationService } from '../../../../core/notifications/notification.service';
import { ConfirmModalComponent } from '../../../../shared/components/confirm-modal.component';
import { IconComponent } from '../../../../shared/components/icon.component';
import { MenuActionsComponent } from '../../components/menu-actions.component';
import { messageErreur } from '../../utils/form';
import { SwotModalComponent } from '../../components/swot-modal.component';
import { TYPES_SWOT } from '../../models/libelles';
import { ElementSwot, TypeSwot } from '../../models/market.models';
import { EtudeStore } from '../../services/etude-store.service';
import { MarketApiService } from '../../services/market-api.service';

/** Onglet « SWOT » (maquette SWOT.dc.html). */
@Component({
  selector: 'app-swot',
  imports: [ConfirmModalComponent, IconComponent, MenuActionsComponent, SwotModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './swot.page.html',
  styleUrl: './swot.page.scss',
})
export class SwotPage {
  protected readonly store = inject(EtudeStore);
  private readonly api = inject(MarketApiService);
  private readonly notifications = inject(NotificationService);
  private readonly locale = inject(LOCALE_ID);

  protected readonly generationEnCours = signal(false);
  protected readonly modal = signal<{ element: ElementSwot | null; type: TypeSwot } | null>(null);
  protected readonly aSupprimer = signal<ElementSwot | null>(null);
  protected readonly suppressionEnCours = signal(false);

  private readonly elements = computed(() => this.store.etude()?.swot ?? []);

  /** Les 4 quadrants avec leurs éléments et compteurs. */
  protected readonly quadrants = computed(() =>
    TYPES_SWOT.map((t) => {
      const elements = this.elements().filter((e) => e.type === t.type);
      return { ...t, elements, automatiques: elements.filter((e) => e.genere_automatiquement).length };
    }),
  );

  protected readonly resume = computed(() => {
    const elements = this.elements();
    const automatiques = elements.filter((e) => e.genere_automatiquement);
    const manuels = elements.length - automatiques.length;
    const accord = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`;
    const detail = `${accord(automatiques.length, 'élément')} ${automatiques.length > 1 ? 'automatiques' : 'automatique'}, ${manuels} ajouté${manuels > 1 ? 's' : ''} à la main.`;
    if (!automatiques.length) return `Aucune génération pour le moment · ${detail}`;
    const derniere = automatiques.map((e) => e.date_creation).sort().at(-1)!;
    const date = new Date(derniere);
    const aujourdhui = date.toDateString() === new Date().toDateString();
    const quand = aujourdhui
      ? `aujourd'hui à ${formatDate(date, 'HH:mm', this.locale)}`
      : `le ${formatDate(date, "d MMM y 'à' HH:mm", this.locale)}`;
    return `Dernière génération ${quand} · ${detail}`;
  });

  protected generer(): void {
    const id = this.store.id();
    if (id === null) return;
    this.generationEnCours.set(true);
    this.api.genererSwot(id).subscribe({
      next: (r) => {
        this.generationEnCours.set(false);
        this.notifications.succes(
          `SWOT générée : ${r.generes} élément(s) automatique(s), ${r.conserves} ajout(s) manuel(s) conservé(s).`,
        );
        this.store.recharger();
      },
      error: (e: unknown) => {
        this.generationEnCours.set(false);
        this.notifications.erreur(messageErreur(e, 'Impossible de générer la SWOT.'));
      },
    });
  }

  protected apresEnregistrement(): void {
    this.modal.set(null);
    this.store.recharger();
  }

  protected supprimer(): void {
    const element = this.aSupprimer();
    if (!element) return;
    this.suppressionEnCours.set(true);
    this.api.supprimerElementSwot(element.id).subscribe({
      next: () => {
        this.suppressionEnCours.set(false);
        this.aSupprimer.set(null);
        this.notifications.succes('Élément supprimé de la SWOT.');
        this.store.recharger();
      },
      error: (e: unknown) => {
        this.suppressionEnCours.set(false);
        this.notifications.erreur(messageErreur(e, 'Impossible de supprimer cet élément.'));
      },
    });
  }
}
