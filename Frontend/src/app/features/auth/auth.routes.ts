import { Routes } from '@angular/router';

/**
 * Routes du module « Authentification » (User-Service), chargées à la demande sous
 * /connexion. Montées hors du AppLayoutComponent (voir app.routes.ts) : pas de barre
 * latérale/en-tête sur les pages de connexion/inscription.
 */
export default [
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  {
    path: 'login',
    loadComponent: () => import('./login.component').then((m) => m.LoginComponent),
    title: 'Connexion · LaunchPad AI',
  },
  {
    path: 'register',
    loadComponent: () => import('./register.component').then((m) => m.RegisterComponent),
    title: 'Créer un compte · LaunchPad AI',
  },
  {
    path: 'mot-de-passe-oublie',
    loadComponent: () => import('./mot-de-passe-oublie.page').then((m) => m.MotDePasseOubliePage),
    title: 'Mot de passe oublié · LaunchPad AI',
  },
] satisfies Routes;
