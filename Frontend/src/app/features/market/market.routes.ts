import { Routes } from '@angular/router';

import { MarketComponent } from './market.component';

/**
 * Routes du module « Étude de marché » (chargées à la demande sous /etude-marche).
 * MarketComponent enveloppe tous les écrans et porte les styles du module.
 */
export default [
  {
    path: '',
    component: MarketComponent,
    children: [
      {
        path: '',
        loadComponent: () => import('./pages/liste/etude-liste.page').then((m) => m.EtudeListePage),
        title: 'Mes études de marché · LaunchPad AI',
      },
      {
        path: 'nouvelle',
        loadComponent: () =>
          import('./pages/formulaire/etude-formulaire.page').then((m) => m.EtudeFormulairePage),
        title: 'Créer une étude · LaunchPad AI',
      },
      {
        path: ':id/modifier',
        loadComponent: () =>
          import('./pages/formulaire/etude-formulaire.page').then((m) => m.EtudeFormulairePage),
        title: 'Modifier une étude · LaunchPad AI',
      },
      {
        path: ':id',
        loadComponent: () => import('./pages/detail/etude-detail.page').then((m) => m.EtudeDetailPage),
        children: [
          { path: '', pathMatch: 'full', redirectTo: 'apercu' },
          {
            path: 'apercu',
            loadComponent: () => import('./pages/detail/apercu.page').then((m) => m.ApercuPage),
            title: 'Aperçu · Étude de marché',
          },
          {
            path: 'concurrents',
            loadComponent: () => import('./pages/detail/concurrents.page').then((m) => m.ConcurrentsPage),
            title: 'Concurrents · Étude de marché',
          },
          {
            path: 'tendances',
            loadComponent: () => import('./pages/detail/tendances.page').then((m) => m.TendancesPage),
            title: 'Tendances · Étude de marché',
          },
          {
            path: 'prix',
            loadComponent: () => import('./pages/detail/prix.page').then((m) => m.PrixPage),
            title: 'Comparaison des prix · Étude de marché',
          },
          {
            path: 'personas',
            loadComponent: () => import('./pages/detail/personas.page').then((m) => m.PersonasPage),
            title: 'Personas · Étude de marché',
          },
          {
            path: 'swot',
            loadComponent: () => import('./pages/detail/swot.page').then((m) => m.SwotPage),
            title: 'SWOT · Étude de marché',
          },
          {
            path: 'rapport',
            loadComponent: () => import('./pages/detail/rapport.page').then((m) => m.RapportPage),
            title: 'Rapport · Étude de marché',
          },
        ],
      },
    ],
  },
] satisfies Routes;
