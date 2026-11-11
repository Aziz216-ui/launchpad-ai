import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { ProjetPlateforme, ProjetPlateformeSaisie } from '../models/finance.models';

/**
 * Projets de la plateforme (Projet-Service, via l'API Gateway : environment.aiApiUrl/projets/).
 * Finance n'invente plus d'identifiant : elle travaille sur les vrais projets de l'entrepreneur,
 * les mêmes que ceux du Co-Fondateur IA et de l'étude de marché.
 *
 * entrepreneur_id est l'identifiant de l'utilisateur dans le User-Service (renvoyé à la connexion).
 */
@Injectable({ providedIn: 'root' })
export class ProjetsPlateformeService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.aiApiUrl}/projets`;

  /** Projets d'un entrepreneur, du plus récent au plus ancien. */
  listerDe(entrepreneurId: number): Observable<ProjetPlateforme[]> {
    const params = new HttpParams().set('entrepreneur_id', String(entrepreneurId)).set('page_size', '100');
    return this.http.get<unknown>(`${this.url}/`, { params }).pipe(map(liste));
  }

  lire(id: number): Observable<ProjetPlateforme> {
    return this.http.get<ProjetPlateforme>(`${this.url}/${id}/`);
  }

  creer(entrepreneurId: number, saisie: ProjetPlateformeSaisie): Observable<ProjetPlateforme> {
    return this.http.post<ProjetPlateforme>(`${this.url}/`, { ...saisie, entrepreneur_id: entrepreneurId });
  }
}

/** Le Projet-Service renvoie une liste paginée ({ results }) ; certains environnements renvoient un tableau. */
function liste(reponse: unknown): ProjetPlateforme[] {
  if (Array.isArray(reponse)) return reponse as ProjetPlateforme[];
  const resultats = (reponse as { results?: ProjetPlateforme[] } | null)?.results;
  return Array.isArray(resultats) ? resultats : [];
}
