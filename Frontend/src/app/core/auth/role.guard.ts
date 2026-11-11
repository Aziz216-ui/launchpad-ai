import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService, Role } from '../services/auth.service';
import { routeParDefaut } from './role-routes';

/** Doit juste être connecté ; utilisé sur le shell applicatif (bundle entrepreneur). */
export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.isAuthenticated() ? true : router.createUrlTree(['/connexion/login']);
};

/**
 * Doit être connecté ET avoir un des rôles autorisés, sinon renvoyé vers son propre
 * espace (pas vers une page d'erreur : chacun voit son espace, pas celui d'un autre).
 */
export function roleGuard(...rolesAutorises: Role[]): CanActivateFn {
  return () => {
    const auth = inject(AuthService);
    const router = inject(Router);

    if (!auth.isAuthenticated()) {
      return router.createUrlTree(['/connexion/login']);
    }

    const role = auth.currentUserValue?.role;
    if (role && rolesAutorises.includes(role)) {
      return true;
    }

    return router.createUrlTree([routeParDefaut(role)]);
  };
}
