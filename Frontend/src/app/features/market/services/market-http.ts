import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';

import { TokenService } from '../../../core/auth/token.service';
import { ApiError } from '../../../core/http/api-error';
import { NotificationService } from '../../../core/notifications/notification.service';

/**
 * Intercepteur du module ┬½ ├ëtude de march├⌐ ┬╗ (HttpClient fourni par market.routes.ts).
 *
 * M├¬me r├┤le que l'intercepteur commun (token JWT, ApiError, toast des erreurs serveur),
 * avec des messages adapt├⌐s aux 4 microservices du march├⌐ derri├¿re l'API Gateway :
 * - 404 : ┬½ <ressource> introuvable ┬╗ ;
 * - 503 {"service": "SECTEUR-SERVICE", "message": "Service indisponible"} :
 *   ┬½ Le service <nom> est momentan├⌐ment indisponible, r├⌐essayez plus tard ┬╗.
 */
export const marketInterceptor: HttpInterceptorFn = (requete, suivant) => {
  const token = inject(TokenService).lire();
  const notifications = inject(NotificationService);

  const requeteFinale = token ? requete.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : requete;

  return suivant(requeteFinale).pipe(
    catchError((erreur: unknown) => {
      if (!(erreur instanceof HttpErrorResponse)) return throwError(() => erreur);
      const apiError = erreurMarket(erreur);
      if (apiError.statut === 0 || apiError.statut >= 500) notifications.erreur(apiError.message);
      return throwError(() => apiError);
    }),
  );
};

/** Ressource vis├⌐e par l'URL, pour le message 404. */
const RESSOURCES: [RegExp, string][] = [
  [/\/generer-swot\//, '├ëtude'],
  [/\/etudes\//, '├ëtude'],
  [/\/concurrents\//, 'Concurrent'],
  [/\/tendances\//, 'Tendance'],
  [/\/personas\//, 'Persona'],
  [/\/swot\//, '├ël├⌐ment SWOT'],
  [/\/secteurs\//, 'Secteur'],
];

/** Noms lisibles des services du march├⌐ (champ "service" des 503). */
const SERVICES: Record<string, string> = {
  'SECTEUR-SERVICE': 'Secteurs',
  'CONCURRENT-SERVICE': 'Concurrents',
  'ETUDE-SERVICE': '├ëtudes',
  'SWOT-SERVICE': 'SWOT',
};

export function ressourceDeLUrl(url: string | null): string {
  return RESSOURCES.find(([motif]) => motif.test(url ?? ''))?.[1] ?? '├ël├⌐ment';
}

export function nomService(service: string): string {
  return SERVICES[service] ?? service;
}

/** Traduit une r├⌐ponse d'erreur de la gateway en ApiError avec un message clair. */
export function erreurMarket(reponse: HttpErrorResponse): ApiError {
  if (reponse.status === 503) {
    const service = typeof reponse.error?.service === 'string' ? reponse.error.service : 'demand├⌐';
    return new ApiError(503, `Le service ${nomService(service)} est momentan├⌐ment indisponible, r├⌐essayez plus tard.`);
  }
  const apiError = ApiError.depuis(reponse);
  if (reponse.status === 404) {
    return new ApiError(404, `${ressourceDeLUrl(reponse.url)} introuvable.`, apiError.erreursChamps);
  }
  return apiError;
}
