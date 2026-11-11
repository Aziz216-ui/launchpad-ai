import { Routes } from '@angular/router';

import { FinanceComponent } from './finance.component';
import { roleGuard } from '../../core/auth/role.guard';

/**
 * Routes du module « Finance » (chargées à la demande sous /finance).
 * FinanceComponent enveloppe tous les écrans, porte l'en-tête, les onglets et les styles du module.
 * Accessible à ENTREPRENEUR (propriétaire : saisit, génère, invite des financiers) et FINANCIER
 * (relecteur invité : lecture seule, avis sur les prévisions, certification des documents, sur les
 * seuls projets où il est invité). ADMIN a tous les droits. Les droits fins viennent du backend
 * (GET /projets/{id}/acces) ; les onglets Équipe et Assistant ne s'affichent qu'au propriétaire.
 */
export default [
  {
    path: '',
    component: FinanceComponent,
    canActivate: [roleGuard('ENTREPRENEUR', 'FINANCIER', 'ADMIN')],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'apercu' },
      {
        path: 'apercu',
        loadComponent: () => import('./pages/apercu.page').then((m) => m.ApercuPage),
        title: "Vue d'ensemble · Finance",
      },
      {
        path: 'previsions',
        loadComponent: () => import('./pages/previsions.page').then((m) => m.PrevisionsPage),
        title: 'Prévisions · Finance',
      },
      {
        path: 'projections',
        loadComponent: () => import('./pages/projections.page').then((m) => m.ProjectionsPage),
        title: 'Projections · Finance',
      },
      {
        path: 'documents',
        loadComponent: () => import('./pages/documents.page').then((m) => m.DocumentsPage),
        title: 'Documents · Finance',
      },
      {
        path: 'equipe',
        loadComponent: () => import('./pages/equipe.page').then((m) => m.EquipePage),
        title: 'Équipe · Finance',
      },
      {
        path: 'assistant',
        loadComponent: () => import('./pages/assistant.page').then((m) => m.AssistantPage),
        title: 'Assistant IA · Finance',
      },
    ],
  },
] satisfies Routes;
