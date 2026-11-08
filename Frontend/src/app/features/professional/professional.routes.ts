import { Routes } from '@angular/router';

import { roleGuard } from '../../core/auth/role.guard';

/**
 * Routes du module « Professional » (Professional-Service), chargées à la demande sous
 * /professional. Deux écrans : Comptabilité (rôle ACCOUNTANT) et Avocat (rôle LAWYER).
 * Remplacer les pages provisoires par les pages du module (voir README.md).
 */
export default [
  { path: '', pathMatch: 'full', redirectTo: 'comptabilite' },
  {
    path: 'comptabilite',
    canActivate: [roleGuard('ACCOUNTANT')],
    loadComponent: () => import('./comptabilite-en-cours.page').then((m) => m.ComptabiliteEnCoursPage),
    title: 'Comptabilité · LaunchPad AI',
  },
  {
    path: 'avocat',
    canActivate: [roleGuard('LAWYER')],
    loadComponent: () => import('../lawyer-space/lawyer-space.component').then((m) => m.LawyerSpaceComponent),
    title: 'Avocat · LaunchPad AI',
  },
] satisfies Routes;
