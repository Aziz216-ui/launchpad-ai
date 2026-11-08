import { Routes } from '@angular/router';

import { FinanceComponent } from './finance.component';
import { roleGuard } from '../../core/auth/role.guard';

/**
 * Routes du module « Finance » (chargées à la demande sous /finance).
 * FinanceComponent enveloppe tous les écrans, porte l'en-tête, les onglets et les styles du module.
 * Accessible à ENTREPRENEUR (gère les finances de son propre projet) et FINANCIER (même
 * interface, pas de vue dédiée distincte aujourd'hui) ; ADMIN par défaut comme ENTREPRENEUR.
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
        path: 'assistant',
        loadComponent: () => import('./pages/assistant.page').then((m) => m.AssistantPage),
        title: 'Assistant IA · Finance',
      },
    ],
  },
] satisfies Routes;
