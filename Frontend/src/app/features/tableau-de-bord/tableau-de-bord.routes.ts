import { Routes } from '@angular/router';

/**
 * Routes du module « Tableau de bord », chargées à la demande sous /tableau-de-bord.
 * Remplacer la page provisoire par les pages du module (voir README.md).
 */
export default [
  {
    path: '',
    loadComponent: () => import('./tableau-de-bord-en-cours.page').then((m) => m.TableauDeBordEnCoursPage),
    title: 'Tableau de bord · LaunchPad AI',
  },
] satisfies Routes;
