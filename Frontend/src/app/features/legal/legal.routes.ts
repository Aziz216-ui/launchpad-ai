import { Routes } from '@angular/router';

/**
 * Routes du module « Juridique », chargées à la demande sous /juridique.
 * Remplacer la page provisoire par les pages du module (voir README.md).
 */
export default [
  {
    path: '',
    loadComponent: () => import('./legal-en-cours.page').then((m) => m.LegalEnCoursPage),
    title: 'Juridique · LaunchPad AI',
  },
] satisfies Routes;
