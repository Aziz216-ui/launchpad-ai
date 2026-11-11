import { Routes } from '@angular/router';

import { roleGuard } from '../../core/auth/role.guard';

/**
 * Routes du module « Professional » (Professional-Service), chargées à la demande sous
 * /professional. Deux écrans : Comptabilité et Avocat.
 * LawyerSpaceComponent sert deux vues selon le rôle (voir son flag isLawyer) : gestion
 * cabinet pour LAWYER, annuaire d'avocats/questions/suivi de dossiers pour ENTREPRENEUR -
 * donc accessible aux deux, pas seulement à LAWYER.
 * Comptabilité : accessible à ACCOUNTANT (dossiers confiés) et ENTREPRENEUR (ses dossiers), via
 * l'API Gateway (/api/comptable). comptabilite/comptables : annuaire « Demander un comptable »
 * réservé à l'entrepreneur.
 */
export default [
  { path: '', pathMatch: 'full', redirectTo: 'comptabilite' },
  {
    path: 'comptabilite',
    canActivate: [roleGuard('ACCOUNTANT', 'ENTREPRENEUR', 'ADMIN')],
    loadComponent: () => import('./pages/comptabilite/comptabilite.page').then((m) => m.ComptabilitePage),
    title: 'Comptabilité · LaunchPad AI',
  },
  {
    // Annuaire des comptables : seul un entrepreneur peut envoyer une demande (POST /files)
    path: 'comptabilite/comptables',
    canActivate: [roleGuard('ENTREPRENEUR')],
    loadComponent: () => import('./pages/comptables/comptables.page').then((m) => m.ComptablesPage),
    title: 'Demander un comptable · LaunchPad AI',
  },
  {
    // Détail d'un dossier : documents et messages (comptable du dossier, entrepreneur propriétaire, admin)
    path: 'comptabilite/dossiers/:id',
    canActivate: [roleGuard('ACCOUNTANT', 'ENTREPRENEUR', 'ADMIN')],
    loadComponent: () => import('./pages/dossier/dossier.page').then((m) => m.DossierPage),
    title: 'Dossier comptable · LaunchPad AI',
  },
  {
    path: 'avocat',
    canActivate: [roleGuard('LAWYER', 'ENTREPRENEUR', 'ADMIN')],
    loadComponent: () => import('../lawyer-space/lawyer-space.component').then((m) => m.LawyerSpaceComponent),
    title: 'Avocat · LaunchPad AI',
  },
  {
    // Demande de revue d'un document : l'avocat l'accepte / la refuse et rend son avis ; l'entrepreneur la suit
    path: 'avocat/demandes/:id',
    canActivate: [roleGuard('LAWYER', 'ENTREPRENEUR', 'ADMIN')],
    loadComponent: () => import('../lawyer-space/pages/demande/demande.page').then((m) => m.DemandePage),
    title: "Demande d'avocat · LaunchPad AI",
  },
] satisfies Routes;
