import { HttpClient, HttpResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import {
  CommentaireIa,
  DocumentFinancier,
  DocumentResume,
  DocumentSaisie,
  Ecart,
  FormatExport,
  Marges,
  Prevision,
  PrevisionSaisie,
  Projection,
  ProjectionsSaisie,
  ReponseAssistant,
} from '../models/finance.models';

/** Accès REST au Finance-Service (préfixe environment.financeApiUrl). */
@Injectable({ providedIn: 'root' })
export class FinanceApiService {
  private readonly http = inject(HttpClient);
  private readonly url = environment.financeApiUrl;

  // --- Prévisions (scénarios 1 et 2) ------------------------------------------

  listerPrevisions(projetId: string): Observable<Prevision[]> {
    return this.http.get<Prevision[]>(`${this.url}/projets/${projetId}/previsions`);
  }

  creerPrevision(saisie: PrevisionSaisie): Observable<Prevision> {
    return this.http.post<Prevision>(`${this.url}/previsions`, saisie);
  }

  consulterMarges(previsionId: string): Observable<Marges> {
    return this.http.get<Marges>(`${this.url}/previsions/${previsionId}/marges`);
  }

  consulterEcart(previsionId: string): Observable<Ecart> {
    return this.http.get<Ecart>(`${this.url}/previsions/${previsionId}/ecart`);
  }

  commenterEcart(previsionId: string): Observable<CommentaireIa> {
    return this.http.post<CommentaireIa>(`${this.url}/previsions/${previsionId}/commentaire`, {});
  }

  genererProjections(previsionId: string, saisie: ProjectionsSaisie): Observable<Projection[]> {
    return this.http.post<Projection[]>(`${this.url}/previsions/${previsionId}/projections`, saisie);
  }

  // --- Documents (scénarios 3 et 4) -------------------------------------------

  listerDocuments(projetId: string): Observable<DocumentResume[]> {
    return this.http.get<DocumentResume[]>(`${this.url}/projets/${projetId}/documents`);
  }

  genererDocument(saisie: DocumentSaisie): Observable<DocumentFinancier> {
    return this.http.post<DocumentFinancier>(`${this.url}/documents`, saisie);
  }

  consulterDocument(documentId: string): Observable<DocumentFinancier> {
    return this.http.get<DocumentFinancier>(`${this.url}/documents/${documentId}`);
  }

  /** Fichier à télécharger : la réponse complète donne accès au nom du fichier (Content-Disposition). */
  exporterDocument(documentId: string, format: FormatExport): Observable<HttpResponse<Blob>> {
    return this.http.get(`${this.url}/documents/${documentId}/export`, {
      params: { format },
      responseType: 'blob',
      observe: 'response',
    });
  }

  supprimerDocument(documentId: string): Observable<void> {
    return this.http.delete<void>(`${this.url}/documents/${documentId}`);
  }

  // --- Assistant financier IA -------------------------------------------------

  poserQuestion(projetId: string, message: string): Observable<ReponseAssistant> {
    return this.http.post<ReponseAssistant>(`${this.url}/projets/${projetId}/assistant`, { message });
  }
}
