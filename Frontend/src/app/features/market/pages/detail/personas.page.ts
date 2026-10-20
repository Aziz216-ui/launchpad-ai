import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { NotificationService } from '../../../../core/notifications/notification.service';
import { ConfirmModalComponent } from '../../../../shared/components/confirm-modal.component';
import { EmptyStateComponent } from '../../../../shared/components/empty-state.component';
import { IconComponent } from '../../../../shared/components/icon.component';
import { InitialesPipe, LignesPipe, MontantPipe } from '../../pipes/format.pipes';
import { messageErreur } from '../../utils/form';
import { PersonaModalComponent } from '../../components/persona-modal.component';
import { Persona } from '../../models/market.models';
import { EtudeStore } from '../../services/etude-store.service';
import { MarketApiService } from '../../services/market-api.service';

/** Couleurs des pastilles des personas, dans l'ordre des maquettes. */
const COULEURS = [
  { fond: '#E3F0F1', texte: '#1F6470' },
  { fond: '#E8F5EE', texte: '#24704C' },
  { fond: '#FDF0DC', texte: '#9A5B07' },
];

/** Onglet « Personas » (maquette Main.dc.html). */
@Component({
  selector: 'app-personas',
  imports: [ConfirmModalComponent, EmptyStateComponent, IconComponent, PersonaModalComponent, InitialesPipe, LignesPipe, MontantPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './personas.page.html',
  styleUrl: './personas.page.scss',
})
export class PersonasPage {
  protected readonly store = inject(EtudeStore);
  private readonly api = inject(MarketApiService);
  private readonly notifications = inject(NotificationService);

  protected readonly couleurs = COULEURS;
  protected readonly personas = computed(() => this.store.etude()?.personas ?? []);

  /** null : fermée ; { persona: null } : création ; { persona } : modification. */
  protected readonly modal = signal<{ persona: Persona | null } | null>(null);
  protected readonly aSupprimer = signal<Persona | null>(null);
  protected readonly suppressionEnCours = signal(false);

  protected apresEnregistrement(): void {
    this.modal.set(null);
    this.store.recharger();
  }

  protected supprimer(): void {
    const persona = this.aSupprimer();
    if (!persona) return;
    this.suppressionEnCours.set(true);
    this.api.supprimerPersona(persona.id).subscribe({
      next: () => {
        this.suppressionEnCours.set(false);
        this.aSupprimer.set(null);
        this.notifications.succes(`Le persona « ${persona.nom} » a été supprimé.`);
        this.store.recharger();
      },
      error: (e: unknown) => {
        this.suppressionEnCours.set(false);
        this.notifications.erreur(messageErreur(e, 'Impossible de supprimer ce persona.'));
      },
    });
  }
}
