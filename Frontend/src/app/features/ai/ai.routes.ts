import { Routes } from '@angular/router';

import { AiComponent } from './ai.component';
import { ProjetApiService } from './services/projet-api.service';
import { RecommandationApiService } from './services/recommandation-api.service';
import { ConversationApiService } from './services/conversation-api.service';

/**
 * Routes du module « Co-Fondateur IA », chargées à la demande sous /co-fondateur-ia.
 * AiComponent enveloppe toutes les pages du module.
 * Les 3 services sont fournis ici pour être disponibles dans toutes les pages.
 */
export default [
  {
    path: '',
    component: AiComponent,
    providers: [ProjetApiService, RecommandationApiService, ConversationApiService],
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'projet',
      },
      {
        path: 'projet',
        loadComponent: () => import('./pages/projet/projet.page').then((m) => m.ProjetPage),
        title: 'Mon Projet & Diagnostic · Co-Fondateur IA',
      },
      {
        path: 'recommandations',
        loadComponent: () =>
          import('./pages/recommandations/recommandations.page').then((m) => m.RecommandationsPage),
        title: 'Plan d\'action & Recommandations · Co-Fondateur IA',
      },
      {
        path: 'chat',
        loadComponent: () => import('./pages/chat/chat.page').then((m) => m.ChatPage),
        title: 'Chat Co-Fondateur · Co-Fondateur IA',
      },
    ],
  },
] satisfies Routes;

