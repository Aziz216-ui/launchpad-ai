import { Routes } from '@angular/router';

/**
 * Routes du module « Professional » (Professional-Service), chargées à la demande sous
 * /professional. Deux écrans : Comptabilité et Avocat.
 * Remplacer les pages provisoires par les pages du module (voir README.md).
 */
export default [
  { path: '', pathMatch: 'full', redirectTo: 'comptabilite' },
  {
    path: 'comptabilite',
    loadComponent: () => import('./comptabilite-en-cours.page').then((m) => m.ComptabiliteEnCoursPage),
    title: 'Comptabilité · LaunchPad AI',
  },
  {
    path: 'avocat',
    loadComponent: () => import('./avocat-en-cours.page').then((m) => m.AvocatEnCoursPage),
    title: 'Avocat · LaunchPad AI',
  },
] satisfies Routes;
