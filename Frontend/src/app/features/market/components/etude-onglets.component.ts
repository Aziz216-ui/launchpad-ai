import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

import { EtudeStore } from '../services/etude-store.service';

/** Barre d'onglets d'une étude (les compteurs viennent de l'API). */
@Component({
  selector: 'app-etude-onglets',
  imports: [RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav aria-label="Sections de l'étude">
      @for (onglet of onglets(); track onglet.route) {
        <a [routerLink]="onglet.route" routerLinkActive="actif" ariaCurrentWhenActive="page">{{ onglet.libelle }}</a>
      }
    </nav>
  `,
  styles: `
    nav {
      display: flex;
      gap: 4px;
      border-bottom: 1px solid #e3e8ea;
      overflow-x: auto;
    }
    a {
      padding: 12px 14px;
      font-size: 13px;
      color: #5a6a6f;
      text-decoration: none;
      white-space: nowrap;
      border-bottom: 2px solid transparent;
    }
    a:hover {
      color: #1f6470;
    }
    a.actif {
      color: #1f6470;
      font-weight: 600;
      border-bottom-color: #2b7a86;
    }
  `,
})
export class EtudeOngletsComponent {
  private readonly store = inject(EtudeStore);

  protected readonly onglets = computed(() => {
    const etude = this.store.etude();
    const nbConcurrents = etude?.concurrents.length ?? 0;
    const nbPersonas = etude?.personas.length ?? 0;
    return [
      { route: 'apercu', libelle: 'Aperçu' },
      { route: 'concurrents', libelle: `Concurrents ${nbConcurrents}` },
      { route: 'tendances', libelle: 'Tendances' },
      { route: 'prix', libelle: 'Comparaison des offres et des prix' },
      { route: 'personas', libelle: `Personas ${nbPersonas}` },
      { route: 'swot', libelle: 'SWOT' },
      { route: 'rapport', libelle: 'Rapport' },
    ];
  });
}
