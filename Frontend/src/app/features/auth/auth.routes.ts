import { Routes } from '@angular/router';

/**
 * Routes du module « Authentification » (User-Service), chargées à la demande sous /connexion.
 * Remplacer la page provisoire par les pages du module (voir README.md).
 */
export default [
  {
    path: '',
    loadComponent: () => import('./auth-en-cours.page').then((m) => m.AuthEnCoursPage),
    title: 'Connexion · LaunchPad AI',
  },
] satisfies Routes;
