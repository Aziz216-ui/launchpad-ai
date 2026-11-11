import { HttpContextToken, HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';

import { AuthService } from '../services/auth.service';
import { TokenService } from '../auth/token.service';
import { NotificationService } from '../notifications/notification.service';
import { ApiError } from './api-error';

/** Endpoints d'auth exclus du rafraîchissement automatique, pour éviter une boucle infinie. */
const ENDPOINTS_SANS_RAFRAICHISSEMENT = ['/login/', '/register/', '/refresh/', '/logout/'];

/**
 * Requêtes de fond (ex. interrogation périodique des notifications) : pas de toast d'erreur,
 * sinon un service arrêté afficherait une alerte toutes les 30 secondes.
 * Usage : this.http.get(url, { context: new HttpContext().set(SANS_TOAST_ERREUR, true) }).
 */
export const SANS_TOAST_ERREUR = new HttpContextToken<boolean>(() => false);

/**
 * Intercepteur commun à tous les appels HTTP :
 * - ajoute le token JWT quand il existe ;
 * - sur un 401 (jeton expiré, 5 min de durée de vie côté Keycloak), tente un
 *   rafraîchissement via le refresh token puis rejoue la requête une seule fois ;
 *   si le rafraîchissement échoue aussi, déconnecte et renvoie vers la connexion ;
 * - transforme les erreurs en ApiError ;
 * - affiche un toast pour les erreurs réseau et serveur (les erreurs 400 et 404
 *   sont gérées par les écrans, au plus près des champs concernés).
 */
export const apiInterceptor: HttpInterceptorFn = (requete, suivant) => {
  const tokenService = inject(TokenService);
  const authService = inject(AuthService);
  const router = inject(Router);
  const notifications = inject(NotificationService);

  const avecToken = (req = requete) => {
    const token = tokenService.lire();
    return token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;
  };

  const estEndpointAuthSensible = ENDPOINTS_SANS_RAFRAICHISSEMENT.some((p) => requete.url.includes(p));

  return suivant(avecToken()).pipe(
    catchError((erreur: unknown) => {
      if (erreur instanceof HttpErrorResponse && erreur.status === 401 && !estEndpointAuthSensible) {
        return authService.refresh().pipe(
          switchMap(() => suivant(avecToken())),
          catchError(() => {
            authService.logout();
            router.navigateByUrl('/connexion/login');
            return throwError(() => erreur);
          }),
        );
      }
      return throwError(() => erreur);
    }),
    catchError((erreur: unknown) => {
      if (!(erreur instanceof HttpErrorResponse)) {
        return throwError(() => erreur);
      }
      const apiError = ApiError.depuis(erreur);
      if ((apiError.statut === 0 || apiError.statut >= 500) && !requete.context.get(SANS_TOAST_ERREUR)) {
        notifications.erreur(apiError.message);
      }
      return throwError(() => apiError);
    }),
  );
};
