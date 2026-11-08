import { Routes } from '@angular/router';

import { roleGuard } from '../../core/auth/role.guard';

/**
 * Routes du module « Professional » (Professional-Service), chargées à la demande sous
 * /professional. Deux écrans : Comptabilité et Avocat.
 * LawyerSpaceComponent sert deux vues selon le rôle (voir son flag isLawyer) : gestion
 * cabinet pour LAWYER, annuaire d'avocats/questions/suivi de dossiers pour ENTREPRENEUR -
 * donc accessible aux deux, pas seulement à LAWYER.
 * Comptabilité : accessible à ACCOUNTANT (son espace) et ENTREPRENEUR (suivi de sa propre
 * comptabilité) - la page elle-même est encore provisoire pour tout le monde (Professional-
 * Service n'est pas encore branché sur la Gateway/le Frontend, voir README.md).
 */
export default [
  { path: '', pathMatch: 'full', redirectTo: 'comptabilite' },
  {
    path: 'comptabilite',
    canActivate: [roleGuard('ACCOUNTANT', 'ENTREPRENEUR', 'ADMIN')],
    loadComponent: () => import('./comptabilite-en-cours.page').then((m) => m.ComptabiliteEnCoursPage),
    title: 'Comptabilité · LaunchPad AI',
  },
  {
    path: 'avocat',
    canActivate: [roleGuard('LAWYER', 'ENTREPRENEUR', 'ADMIN')],
    loadComponent: () => import('../lawyer-space/lawyer-space.component').then((m) => m.LawyerSpaceComponent),
    title: 'Avocat · LaunchPad AI',
  },
] satisfies Routes;
