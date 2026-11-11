import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '../../../../environments/environment';
import {
  AffectationDossier,
  DemandeDossier,
  DepotDocument,
  DocumentComptable,
  DossierComptable,
  EspaceComptable,
  MessageDossier,
  Moi,
  Page,
  StatutDocument,
  StatutDossier,
  ValidationDocument,
} from '../models/comptabilite.models';

/**
 * Appels à l'espace comptable via l'API Gateway (/api/comptable/**, jeton ajouté par l'intercepteur).
 * Réponses : { data } pour un élément, { data, meta } pour une liste paginée.
 */
@Injectable({ providedIn: 'root' })
export class ComptabiliteApiService {
  private readonly http = inject(HttpClient);
  private readonly url = environment.professionalApiUrl;

  // --- Identité et annuaire -------------------------------------------------------------------

  moi(): Observable<Moi> {
    return this.http.get<{ data: Moi }>(`${this.url}/me`).pipe(map((r) => r.data));
  }

  /** Annuaire : comptables actifs qui acceptent de nouveaux clients. */
  listerComptables(): Observable<EspaceComptable[]> {
    const params = new HttpParams().set('limit', 100);
    return this.http.get<Page<EspaceComptable>>(`${this.url}/workspaces`, { params }).pipe(map((r) => r.data));
  }

  // --- Dossiers ------------------------------------------------------------------------------

  /** Dossiers visibles par l'utilisateur connecté (les siens pour un entrepreneur, ceux de son espace pour un comptable). */
  listerDossiers(options: { statut?: StatutDossier | null; page?: number; limite?: number } = {}): Observable<Page<DossierComptable>> {
    let params = new HttpParams().set('page', options.page ?? 1).set('limit', options.limite ?? 20);
    if (options.statut) {
      params = params.set('status', options.statut);
    }
    return this.http.get<Page<DossierComptable>>(`${this.url}/files`, { params });
  }

  /** Nombre de dossiers d'un statut (ou de tous), sans charger la liste. */
  compterDossiers(statut: StatutDossier | null): Observable<number> {
    return this.listerDossiers({ statut, limite: 1 }).pipe(map((r) => r.meta.total));
  }

  dossier(id: string): Observable<DossierComptable> {
    return this.http.get<{ data: DossierComptable }>(`${this.url}/files/${id}`).pipe(map((r) => r.data));
  }

  demanderDossier(demande: DemandeDossier): Observable<DossierComptable> {
    return this.http.post<{ data: DossierComptable }>(`${this.url}/files`, demande).pipe(map((r) => r.data));
  }

  accepterDossier(id: string): Observable<DossierComptable> {
    return this.http.post<{ data: DossierComptable }>(`${this.url}/files/${id}/accept`, {}).pipe(map((r) => r.data));
  }

  refuserDossier(id: string, reason: string): Observable<DossierComptable> {
    return this.http.post<{ data: DossierComptable }>(`${this.url}/files/${id}/reject`, { reason }).pipe(map((r) => r.data));
  }

  cloturerDossier(id: string): Observable<DossierComptable> {
    return this.http.post<{ data: DossierComptable }>(`${this.url}/files/${id}/close`, {}).pipe(map((r) => r.data));
  }

  affectations(id: string): Observable<AffectationDossier[]> {
    const params = new HttpParams().set('limit', 100);
    return this.http.get<Page<AffectationDossier>>(`${this.url}/files/${id}/assignments`, { params }).pipe(map((r) => r.data));
  }

  // --- Documents -----------------------------------------------------------------------------

  listerDocuments(
    dossierId: string,
    options: { statut?: StatutDocument | null; historique?: boolean; limite?: number } = {},
  ): Observable<Page<DocumentComptable>> {
    let params = new HttpParams().set('limit', options.limite ?? 100);
    if (options.statut) params = params.set('status', options.statut);
    if (options.historique) params = params.set('includeHistory', 'true');
    return this.http.get<Page<DocumentComptable>>(`${this.url}/files/${dossierId}/documents`, { params });
  }

  compterDocuments(dossierId: string, statut: StatutDocument): Observable<number> {
    return this.listerDocuments(dossierId, { statut, limite: 1 }).pipe(map((r) => r.meta.total));
  }

  deposerDocument(dossierId: string, depot: DepotDocument, fichier: File): Observable<DocumentComptable> {
    return this.http
      .post<{ data: DocumentComptable }>(`${this.url}/files/${dossierId}/documents`, formulaire(depot, fichier))
      .pipe(map((r) => r.data));
  }

  /** Nouvelle version d'un document rejeté (entrepreneur). */
  nouvelleVersion(documentId: string, depot: DepotDocument, fichier: File): Observable<DocumentComptable> {
    return this.http
      .post<{ data: DocumentComptable }>(`${this.url}/documents/${documentId}/versions`, formulaire(depot, fichier))
      .pipe(map((r) => r.data));
  }

  validerDocument(documentId: string, comment?: string | null): Observable<unknown> {
    return this.http.post(`${this.url}/documents/${documentId}/validate`, comment ? { comment } : {});
  }

  rejeterDocument(documentId: string, comment: string): Observable<unknown> {
    return this.http.post(`${this.url}/documents/${documentId}/reject`, { comment });
  }

  supprimerDocument(documentId: string): Observable<unknown> {
    return this.http.delete(`${this.url}/documents/${documentId}`);
  }

  validations(documentId: string): Observable<ValidationDocument[]> {
    const params = new HttpParams().set('limit', 100);
    return this.http.get<Page<ValidationDocument>>(`${this.url}/documents/${documentId}/validations`, { params }).pipe(map((r) => r.data));
  }

  telechargerDocument(documentId: string): Observable<Blob> {
    return this.http.get(`${this.url}/documents/${documentId}/download`, { responseType: 'blob' });
  }

  // --- Messages ------------------------------------------------------------------------------

  /** Fil du dossier, le plus récent d'abord (ordre de l'API). */
  listerMessages(dossierId: string): Observable<Page<MessageDossier>> {
    const params = new HttpParams().set('limit', 100);
    return this.http.get<Page<MessageDossier>>(`${this.url}/files/${dossierId}/messages`, { params });
  }

  envoyerMessage(dossierId: string, content: string, documentId?: string | null): Observable<MessageDossier> {
    return this.http
      .post<{ data: MessageDossier }>(`${this.url}/files/${dossierId}/messages`, { content, documentId: documentId || null })
      .pipe(map((r) => r.data));
  }

  marquerLu(messageId: string): Observable<unknown> {
    return this.http.post(`${this.url}/messages/${messageId}/read`, {});
  }
}

function formulaire(depot: DepotDocument, fichier: File): FormData {
  const data = new FormData();
  data.append('file', fichier, fichier.name);
  data.append('title', depot.title);
  data.append('type', depot.type);
  if (depot.periodStart) data.append('periodStart', depot.periodStart);
  if (depot.periodEnd) data.append('periodEnd', depot.periodEnd);
  return data;
}
