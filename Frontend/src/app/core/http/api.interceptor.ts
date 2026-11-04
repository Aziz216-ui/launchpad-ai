import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';

import { TokenService } from '../auth/token.service';
import { NotificationService } from '../notifications/notification.service';
import { ApiError } from './api-error';

/**
 * Intercepteur commun ├á tous les appels HTTP :
 * - ajoute le token JWT quand il existe (futur User-Service) ;
 * - transforme les erreurs en ApiError ;
 * - affiche un toast pour les erreurs r├⌐seau et serveur (les erreurs 400 et 404
 *   sont g├⌐r├⌐es par les ├⌐crans, au plus pr├¿s des champs concern├⌐s).
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
