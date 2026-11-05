import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { Recommandation } from '../models/ai.models';

/**
 * Accès REST au Recommandation-Service via l'API Gateway.
 * Préfixe : environment.aiApiUrl + /recommandations/.
 */
@Injectable()
export class RecommandationApiService {
  private readonly http = inject(HttpClient);
  private readonly url = environment.aiApiUrl;

  listerRecommandations(projetId?: number): Observable<Recommandation[]> {
    let params = new HttpParams();
    if (projetId !== undefined) params = params.set('projet_id', String(projetId));
    return this.http.get<any>(`${this.url}/recommandations/`, { params }).pipe(
      map((res) => (Array.isArray(res) ? res : (res?.results ?? []))),
    );
  }

  modifierStatut(id: number, statut: string): Observable<Recommandation> {
    return this.http.patch<Recommandation>(`${this.url}/recommandations/${id}/statut/`, { statut });
  }

  genererRecommandations(projetId: number): Observable<Recommandation[]> {
    return this.http.post<any>(`${this.url}/recommandations/generer/`, { projet_id: projetId }).pipe(
      map((res) => (Array.isArray(res) ? res : (res?.results ?? []))),
    );
  }
}
