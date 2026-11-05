import { ChangeDetectionStrategy, Component, effect, inject, input, untracked } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';

import { EmptyStateComponent } from '../../../../shared/components/empty-state.component';
import { LoaderComponent } from '../../../../shared/components/loader.component';
import { EtudeEnteteComponent } from '../../components/etude-entete.component';
import { EtudeOngletsComponent } from '../../components/etude-onglets.component';
import { EtudeStore } from '../../services/etude-store.service';

/**
 * Page détail d'une étude : en-tête et onglets communs, puis l'onglet actif.
 * Fournit l'EtudeStore partagé par tous les onglets.
 */
@Component({
  selector: 'app-etude-detail',
  imports: [RouterOutlet, RouterLink, EmptyStateComponent, LoaderComponent, EtudeEnteteComponent, EtudeOngletsComponent],
  providers: [EtudeStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      @if (store.chargement()) {
        <app-loader texte="Chargement de l'étude…" />
      } @else if (store.erreur()) {
        <app-empty-state titre="Étude indisponible" [texte]="store.erreur()!">
          <a class="btn-primaire" routerLink="/etude-marche">Retour à mes études</a>
        </app-empty-state>
      } @else {
        <app-etude-entete />
        <app-etude-onglets />
        <router-outlet />
      }
    </div>
  `,
})
export class EtudeDetailPage {
  protected readonly store = inject(EtudeStore);

  /** Paramètre de route :id. */
  readonly id = input.required<string>();

  constructor() {
    effect(() => {
      const id = Number(this.id());
      untracked(() => this.store.charger(id));
    });
  }
}
