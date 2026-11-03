import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';

import { TokenService } from '../auth/token.service';
import { NotificationService } from '../notifications/notification.service';
import { ApiError } from './api-error';

/**
 * Intercepteur commun à tous les appels HTTP :
 * - ajoute le token JWT quand il existe (futur User-Service) ;
 * - transforme les erreurs en ApiError ;
 * - affiche un toast pour les erreurs réseau et serveur (les erreurs 400 et 404
 *   sont gérées par les écrans, au plus près des champs concernés).
 */
export const apiInterceptor: HttpInterceptorFn = (requete, suivant) => {
  const token = inject(TokenService).lire();
  const notifications = inject(NotificationService);

  const requeteFinale = token
    ? requete.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : requete;

  return suivant(requeteFinale).pipe(
    catchError((erreur: unknown) => {
      if (!(erreur instanceof HttpErrorResponse)) {
        return throwError(() => erreur);
      }
      const apiError = ApiError.depuis(erreur);
      if (apiError.statut === 0 || apiError.statut >= 500) {
        notifications.erreur(apiError.message);
      }
      return throwError(() => apiError);
    }),
  );
};
