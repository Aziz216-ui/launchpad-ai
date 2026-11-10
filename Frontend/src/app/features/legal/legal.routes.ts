import { Routes } from '@angular/router';

import { roleGuard } from '../../core/auth/role.guard';

/**
 * Routes du module « Juridique » (Legal-Service), chargées à la demande sous /juridique.
 * Entrepreneur : documents de son espace, création, suivi jusqu'à la signature.
 * Avocat : /juridique/revue (lien « Documents » de la barre latérale), revue et signature.
 * ADMIN accède aux deux côtés (il voit les documents de tous les projets).
 */
export default [
  {
    path: '',
    pathMatch: 'full',
    canActivate: [roleGuard('ENTREPRENEUR', 'ADMIN')],
    loadComponent: () => import('./pages/documents/documents.page').then((m) => m.DocumentsPage),
    title: 'Juridique · LaunchPad AI',
  },
  {
    path: 'nouveau',
    canActivate: [roleGuard('ENTREPRENEUR')],
    loadComponent: () => import('./pages/nouveau/nouveau-document.page').then((m) => m.NouveauDocumentPage),
    title: 'Nouveau document · LaunchPad AI',
  },
  {
    path: 'documents/:id',
    canActivate: [roleGuard('ENTREPRENEUR', 'ADMIN')],
    loadComponent: () => import('./pages/document/document.page').then((m) => m.DocumentPage),
    title: 'Document juridique · LaunchPad AI',
  },
  {
    path: 'revue',
    canActivate: [roleGuard('LAWYER', 'ADMIN')],
    loadComponent: () => import('./pages/revue/revue-liste.page').then((m) => m.RevueListePage),
    title: 'Documents à revoir · LaunchPad AI',
  },
  {
    path: 'revue/:id',
    canActivate: [roleGuard('LAWYER', 'ADMIN')],
    loadComponent: () => import('./pages/revue/revue-document.page').then((m) => m.RevueDocumentPage),
    title: 'Revue de document · LaunchPad AI',
  },
] satisfies Routes;
