import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { AnalyseProjet, Projet, ProjetSaisie } from '../models/ai.models';

/**
 * Accès REST au Projet-Service et aux analyses via l'API Gateway.
 * Préfixe : environment.aiApiUrl + /projets/ et /analyses/.
 */
@Injectable()
export class ProjetApiService {
  private readonly http = inject(HttpClient);
  private readonly url = environment.aiApiUrl;

  // ─── Projets ───────────────────────────────────────────────────────────────

  listerProjets(): Observable<Projet[]> {
    return this.http.get<any>(`${this.url}/projets/`).pipe(
      map((res) => (Array.isArray(res) ? res : (res?.results ?? []))),
    );
  }

  lireProjet(id: number): Observable<Projet> {
    return this.http.get<Projet>(`${this.url}/projets/${id}/`);
  }

  creerProjet(saisie: ProjetSaisie): Observable<Projet> {
    return this.http.post<Projet>(`${this.url}/projets/`, saisie);
  }

  modifierProjet(id: number, saisie: Partial<ProjetSaisie>): Observable<Projet> {
    return this.http.patch<Projet>(`${this.url}/projets/${id}/`, saisie);
  }

  supprimerProjet(id: number): Observable<void> {
    return this.http.delete<void>(`${this.url}/projets/${id}/`);
  }

  activerProjet(id: number): Observable<Projet> {
    return this.http.post<Projet>(`${this.url}/projets/${id}/activer/`, {});
  }

  analyserProjet(id: number): Observable<AnalyseProjet> {
    return this.http.post<AnalyseProjet>(`${this.url}/projets/${id}/analyser/`, {});
  }

  // ─── Analyses ──────────────────────────────────────────────────────────────

  listerAnalyses(): Observable<AnalyseProjet[]> {
    return this.http.get<any>(`${this.url}/analyses/`).pipe(
      map((res) => {
        const liste = Array.isArray(res) ? res : (res?.results ?? []);
        // Normaliser projet_id si DRF a renvoyé projet au lieu de projet_id
        return liste.map((a: any) => ({
          ...a,
          projet_id: a.projet_id ?? a.projet,
        }));
      }),
    );
  }

  lireAnalyse(id: number): Observable<AnalyseProjet> {
    return this.http.get<AnalyseProjet>(`${this.url}/analyses/${id}/`);
  }

  supprimerAnalyse(id: number): Observable<void> {
    return this.http.delete<void>(`${this.url}/analyses/${id}/`);
  }
}
