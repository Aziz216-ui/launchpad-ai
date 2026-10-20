import { Routes } from '@angular/router';

/**
 * Routes du module « Co-Fondateur IA », chargées à la demande sous /co-fondateur-ia.
 * Remplacer la page provisoire par les pages du module (voir README.md).
 */
export default [
  {
    path: '',
    loadComponent: () => import('./ai-en-cours.page').then((m) => m.AiEnCoursPage),
    title: 'Co-Fondateur IA · LaunchPad AI',
  },
] satisfies Routes;
