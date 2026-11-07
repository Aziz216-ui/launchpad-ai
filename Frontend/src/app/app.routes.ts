import { Routes } from '@angular/router';

import { AppLayoutComponent } from './layout/app-layout.component';

/**
 * Une route lazy par module : loadChildren vers features/<module>/<module>.routes.ts.
 * Les dossiers portent le nom du service backend (market, ai, legal…), les URL restent en français.
 * Ajouter un module = ajouter une ligne ici et une ligne dans layout/menu.ts.
 */
export const routes: Routes = [
  {
    path: '',
    component: AppLayoutComponent,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'etude-marche' },
      { path: 'tableau-de-bord', loadChildren: () => import('./features/tableau-de-bord/tableau-de-bord.routes') },
      { path: 'co-fondateur-ia', loadChildren: () => import('./features/ai/ai.routes') },
      { path: 'etude-marche', loadChildren: () => import('./features/market/market.routes') },
      { path: 'finance', loadChildren: () => import('./features/finance/finance.routes') },
      { path: 'juridique', loadChildren: () => import('./features/legal/legal.routes') },
      // Comptabilité et Avocat : /professional/comptabilite et /professional/avocat
      { path: 'professional', loadChildren: () => import('./features/professional/professional.routes') },
      { path: 'comptabilite', redirectTo: 'professional/comptabilite' },
      { path: 'avocat', redirectTo: 'professional/avocat' },
      { path: 'connexion', loadChildren: () => import('./features/auth/auth.routes') },
      { path: '**', redirectTo: 'etude-marche' },
    ],
  },
];
