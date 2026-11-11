import { inject } from '@angular/core';
import { Routes } from '@angular/router';

import { AppLayoutComponent } from './layout/app-layout.component';
import { authGuard } from './core/auth/role.guard';
import { routeParDefaut } from './core/auth/role-routes';
import { AuthService } from './core/services/auth.service';

/**
 * Une route lazy par module : loadChildren vers features/<module>/<module>.routes.ts.
 * Les dossiers portent le nom du service backend (market, ai, legal…), les URL restent en français.
 * Ajouter un module = ajouter une ligne ici et une ligne dans layout/menu.ts.
 *
 * /connexion est hors du AppLayoutComponent (pas de barre latérale sur login/register).
 * authGuard protège tout le reste (il faut être connecté) ; les restrictions plus fines
 * par rôle (LAWYER/ACCOUNTANT/FINANCIER) sont posées dans le fichier de routes de chaque
 * module concerné (professional.routes.ts, finance.routes.ts).
 */
export const routes: Routes = [
  { path: 'connexion', loadChildren: () => import('./features/auth/auth.routes') },
  {
    path: '',
    component: AppLayoutComponent,
    canActivate: [authGuard],
    children: [
      {
        path: '',
        pathMatch: 'full',
        // Racine du shell : atterrit sur l'espace du rôle connecté (authGuard du parent
        // garantit qu'on est déjà connecté ici), pas toujours sur Étude de marché.
        redirectTo: () => routeParDefaut(inject(AuthService).currentUserValue?.role),
      },
      { path: 'tableau-de-bord', loadChildren: () => import('./features/tableau-de-bord/tableau-de-bord.routes') },
      { path: 'co-fondateur-ia', loadChildren: () => import('./features/ai/ai.routes') },
      { path: 'etude-marche', loadChildren: () => import('./features/market/market.routes') },
      { path: 'finance', loadChildren: () => import('./features/finance/finance.routes') },
      { path: 'juridique', loadChildren: () => import('./features/legal/legal.routes') },
      // Comptabilité et Avocat : /professional/comptabilite et /professional/avocat
      { path: 'professional', loadChildren: () => import('./features/professional/professional.routes') },
      { path: 'comptabilite', redirectTo: 'professional/comptabilite' },
      { path: 'avocat', redirectTo: 'professional/avocat' },
      { path: '**', redirectTo: () => routeParDefaut(inject(AuthService).currentUserValue?.role) },
    ],
  },
];
