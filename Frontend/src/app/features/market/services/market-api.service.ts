import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import {
  ComparaisonPrix,
  Concurrent,
  ConcurrentSaisie,
  ElementSwot,
  ElementSwotSaisie,
  EtudeMarche,
  EtudeMarcheDetail,
  EtudeSaisie,
  GenererSwotReponse,
  OpportunitesMenaces,
  Persona,
  PersonaSaisie,
  RapportEtude,
  Secteur,
  Tendance,
} from '../models/market.models';

/** Accès REST au Market-Service (préfixe environment.marketApiUrl). */
@Injectable({ providedIn: 'root' })
export class MarketApiService {
  private readonly http = inject(HttpClient);
  private readonly url = environment.marketApiUrl;

  // --- Études -----------------------------------------------------------------

  listerEtudes(filtres: { search?: string; statut?: string; entrepreneur_id?: number } = {}): Observable<EtudeMarche[]> {
    return this.http.get<EtudeMarche[]>(`${this.url}/etudes/`, { params: parametres(filtres) });
  }

  lireEtude(id: number): Observable<EtudeMarcheDetail> {
    return this.http.get<EtudeMarcheDetail>(`${this.url}/etudes/${id}/`);
  }

  creerEtude(saisie: EtudeSaisie): Observable<EtudeMarche> {
    return this.http.post<EtudeMarche>(`${this.url}/etudes/`, saisie);
  }

  modifierEtude(id: number, saisie: EtudeSaisie): Observable<EtudeMarche> {
    return this.http.patch<EtudeMarche>(`${this.url}/etudes/${id}/`, saisie);
  }

  supprimerEtude(id: number): Observable<void> {
    return this.http.delete<void>(`${this.url}/etudes/${id}/`);
  }

  finaliserEtude(id: number): Observable<EtudeMarcheDetail> {
    return this.http.post<EtudeMarcheDetail>(`${this.url}/etudes/${id}/finaliser/`, {});
  }

  comparaisonPrix(id: number): Observable<ComparaisonPrix> {
    return this.http.get<ComparaisonPrix>(`${this.url}/etudes/${id}/comparaison-prix/`);
  }

  opportunitesMenaces(id: number): Observable<OpportunitesMenaces> {
    return this.http.get<OpportunitesMenaces>(`${this.url}/etudes/${id}/opportunites-menaces/`);
  }

  genererSwot(id: number): Observable<GenererSwotReponse> {
    return this.http.post<GenererSwotReponse>(`${this.url}/etudes/${id}/generer-swot/`, {});
  }

  rapport(id: number): Observable<RapportEtude> {
    return this.http.get<RapportEtude>(`${this.url}/etudes/${id}/rapport/`);
  }

  rapportPdf(id: number): Observable<Blob> {
    return this.http.get(`${this.url}/etudes/${id}/rapport/pdf/`, { responseType: 'blob' });
  }

  // --- Référentiels -------------------------------------------------------------

  listerSecteurs(): Observable<Secteur[]> {
    return this.http.get<Secteur[]>(`${this.url}/secteurs/`);
  }

  listerConcurrents(filtres: { secteur?: number } = {}): Observable<Concurrent[]> {
    return this.http.get<Concurrent[]>(`${this.url}/concurrents/`, { params: parametres(filtres) });
  }

  creerConcurrent(saisie: ConcurrentSaisie): Observable<Concurrent> {
    return this.http.post<Concurrent>(`${this.url}/concurrents/`, saisie);
  }

  modifierConcurrent(id: number, saisie: ConcurrentSaisie): Observable<Concurrent> {
    return this.http.patch<Concurrent>(`${this.url}/concurrents/${id}/`, saisie);
  }

  supprimerConcurrent(id: number): Observable<void> {
    return this.http.delete<void>(`${this.url}/concurrents/${id}/`);
  }

  listerTendances(filtres: { secteur?: number } = {}): Observable<Tendance[]> {
    return this.http.get<Tendance[]>(`${this.url}/tendances/`, { params: parametres(filtres) });
  }

  // --- Personas -------------------------------------------------------------------

  creerPersona(saisie: PersonaSaisie): Observable<Persona> {
    return this.http.post<Persona>(`${this.url}/personas/`, saisie);
  }

  modifierPersona(id: number, saisie: Partial<PersonaSaisie>): Observable<Persona> {
    return this.http.patch<Persona>(`${this.url}/personas/${id}/`, saisie);
  }

  supprimerPersona(id: number): Observable<void> {
    return this.http.delete<void>(`${this.url}/personas/${id}/`);
  }

  // --- Éléments SWOT --------------------------------------------------------------

  creerElementSwot(saisie: ElementSwotSaisie): Observable<ElementSwot> {
    return this.http.post<ElementSwot>(`${this.url}/swot/`, saisie);
  }

  modifierElementSwot(id: number, saisie: Partial<ElementSwotSaisie>): Observable<ElementSwot> {
    return this.http.patch<ElementSwot>(`${this.url}/swot/${id}/`, saisie);
  }

  supprimerElementSwot(id: number): Observable<void> {
    return this.http.delete<void>(`${this.url}/swot/${id}/`);
  }
}

/** Construit les paramètres de requête en ignorant les valeurs vides. */
function parametres(filtres: Record<string, string | number | undefined>): HttpParams {
  let params = new HttpParams();
  for (const [cle, valeur] of Object.entries(filtres)) {
    if (valeur !== undefined && valeur !== '') params = params.set(cle, String(valeur));
  }
  return params;
}
