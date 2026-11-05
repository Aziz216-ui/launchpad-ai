import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { Routes } from '@angular/router';

import { MarketComponent } from './market.component';
import { MarketApiService } from './services/market-api.service';
import { marketInterceptor } from './services/market-http';

/**
 * Routes du module ┬½ ├ëtude de march├⌐ ┬╗ (charg├⌐es ├á la demande sous /etude-marche).
 * MarketComponent enveloppe tous les ├⌐crans et porte les styles du module.
 * Le module a son propre HttpClient : marketInterceptor traduit les erreurs 404 et 503
 * de l'API Gateway (voir services/market-http.ts).
 */
export default [
  {
    path: '',
    component: MarketComponent,
    providers: [provideHttpClient(withInterceptors([marketInterceptor])), MarketApiService],
    children: [
      {
        path: '',
        loadComponent: () => import('./pages/liste/etude-liste.page').then((m) => m.EtudeListePage),
        title: 'Mes ├⌐tudes de march├⌐ ┬╖ LaunchPad AI',
      },
      {
        path: 'nouvelle',
        loadComponent: () =>
          import('./pages/formulaire/etude-formulaire.page').then((m) => m.EtudeFormulairePage),
        title: 'Cr├⌐er une ├⌐tude ┬╖ LaunchPad AI',
      },
      {
        path: ':id/modifier',
        loadComponent: () =>
          import('./pages/formulaire/etude-formulaire.page').then((m) => m.EtudeFormulairePage),
        title: 'Modifier une ├⌐tude ┬╖ LaunchPad AI',
      },
      {
        path: ':id',
        loadComponent: () => import('./pages/detail/etude-detail.page').then((m) => m.EtudeDetailPage),
        children: [
          { path: '', pathMatch: 'full', redirectTo: 'apercu' },
          {
            path: 'apercu',
            loadComponent: () => import('./pages/detail/apercu.page').then((m) => m.ApercuPage),
            title: 'Aper├ºu ┬╖ ├ëtude de march├⌐',
          },
          {
            path: 'concurrents',
            loadComponent: () => import('./pages/detail/concurrents.page').then((m) => m.ConcurrentsPage),
            title: 'Concurrents ┬╖ ├ëtude de march├⌐',
          },
          {
            path: 'tendances',
            loadComponent: () => import('./pages/detail/tendances.page').then((m) => m.TendancesPage),
            title: 'Tendances ┬╖ ├ëtude de march├⌐',
          },
          {
            path: 'prix',
            loadComponent: () => import('./pages/detail/prix.page').then((m) => m.PrixPage),
            title: 'Comparaison des prix ┬╖ ├ëtude de march├⌐',
          },
          {
            path: 'personas',
            loadComponent: () => import('./pages/detail/personas.page').then((m) => m.PersonasPage),
            title: 'Personas ┬╖ ├ëtude de march├⌐',
          },
          {
            path: 'swot',
            loadComponent: () => import('./pages/detail/swot.page').then((m) => m.SwotPage),
            title: 'SWOT ┬╖ ├ëtude de march├⌐',
          },
          {
            path: 'rapport',
            loadComponent: () => import('./pages/detail/rapport.page').then((m) => m.RapportPage),
            title: 'Rapport ┬╖ ├ëtude de march├⌐',
          },
        ],
      },
    ],
  },
] satisfies Routes;
