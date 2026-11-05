import { Routes } from '@angular/router';

/**
 * Routes du module ┬½ Finance ┬╗, charg├⌐es ├á la demande sous /finance.
 * Remplacer la page provisoire par les pages du module (voir README.md).
 */
export default [
  {
    path: '',
    loadComponent: () => import('./finance-en-cours.page').then((m) => m.FinanceEnCoursPage),
    title: 'Finance ┬╖ LaunchPad AI',
  },
] satisfies Routes;
