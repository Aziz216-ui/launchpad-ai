import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { AuthService } from '../../../core/services/auth.service';
import {
  Clause,
  Commentaire,
  DocumentDetail,
  DocumentJuridique,
  FiltresDocuments,
  StatutSignature,
  TypeDocumentJuridique,
} from '../models/legal.models';

/**
 * Appels au Legal-Service via l'API Gateway (/api/legal, jeton ajouté par l'intercepteur).
 * Côté entrepreneur : /documents/** ; côté avocat : /verification/documents/**.
 */
@Injectable({ providedIn: 'root' })
export class LegalApiService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly url = environment.legalApiUrl;

  /**
   * Espace documentaire de l'entrepreneur connecté : le Legal-Service ne connaît pas les utilisateurs,
   * les documents sont rangés par projetId. Un projetId par entrepreneur ⇒ chacun ne voit que les siens.
   */
  projetCourant(): string {
    const u = this.auth.currentUserValue;
    return `ent-${(u?.username ?? 'anonyme').toLowerCase()}`;
  }

  // --- Entrepreneur ----------------------------------------------------------------------------

  generer(type: TypeDocumentJuridique, params: Record<string, unknown>): Observable<DocumentDetail> {
    return this.http.post<DocumentDetail>(`${this.url}/documents/generate`, { type, projetId: this.projetCourant(), params });
  }

  lister(filtres: FiltresDocuments = {}): Observable<DocumentJuridique[]> {
    let params = new HttpParams();
    for (const [cle, valeur] of Object.entries(filtres)) {
      if (valeur) params = params.set(cle, valeur);
    }
    return this.http.get<DocumentJuridique[]>(`${this.url}/documents`, { params });
  }

  document(id: string): Observable<DocumentDetail> {
    return this.http.get<DocumentDetail>(`${this.url}/documents/${id}`);
  }

  modifier(id: string, modifs: { titre?: string; metadata?: Record<string, unknown> }): Observable<DocumentJuridique> {
    return this.http.patch<DocumentJuridique>(`${this.url}/documents/${id}`, modifs);
  }

  modifierClause(id: string, numero: number, texte: string, titre?: string | null): Observable<Clause> {
    return this.http.patch<Clause>(`${this.url}/documents/${id}/clauses/${numero}`, titre ? { texte, titre } : { texte });
  }

  envoyerEnValidation(id: string, clientId: string): Observable<DocumentJuridique> {
    return this.http.post<DocumentJuridique>(`${this.url}/documents/${id}/validation-requests`, { clientId });
  }

  commentaires(id: string): Observable<Commentaire[]> {
    return this.http.get<Commentaire[]>(`${this.url}/documents/${id}/comments`);
  }

  demanderSignatures(id: string, signataires: string[]): Observable<DocumentJuridique> {
    return this.http.post<DocumentJuridique>(`${this.url}/documents/${id}/signatures`, { signataires });
  }

  statutSignatures(id: string): Observable<StatutSignature> {
    return this.http.get<StatutSignature>(`${this.url}/documents/${id}/signatures/status`);
  }

  exporterPdf(id: string): Observable<Blob> {
    return this.http.get(`${this.url}/documents/${id}/export`, { params: { format: 'pdf' }, responseType: 'blob' });
  }

  archiver(id: string): Observable<DocumentJuridique> {
    return this.http.post<DocumentJuridique>(`${this.url}/documents/${id}/archive`, {});
  }

  /** Réservé à ADMIN par la Gateway (toute requête DELETE). */
  supprimer(id: string): Observable<void> {
    return this.http.delete<void>(`${this.url}/documents/${id}`);
  }

  // --- Avocat ----------------------------------------------------------------------------------

  /** Documents de tous les projets, filtrés par statut (EN_VALIDATION : à revoir). */
  listerPourRevue(statut: FiltresDocuments['statut'], type?: FiltresDocuments['type']): Observable<DocumentJuridique[]> {
    return this.lister({ statut, type });
  }

  documentEnRevue(id: string): Observable<DocumentDetail> {
    return this.http.get<DocumentDetail>(`${this.url}/verification/documents/${id}`);
  }

  corrigerClause(id: string, numero: number, texte: string): Observable<Clause> {
    return this.http.patch<Clause>(`${this.url}/verification/documents/${id}/clauses/${numero}`, { texte });
  }

  ajouterCommentaire(id: string, texte: string, auteur?: string): Observable<Commentaire> {
    return this.http.post<Commentaire>(`${this.url}/verification/documents/${id}/comments`, auteur ? { texte, auteur } : { texte });
  }

  demanderInformations(id: string, question: string, avocat?: string): Observable<unknown> {
    return this.http.post(`${this.url}/verification/documents/${id}/info-requests`, avocat ? { question, avocat } : { question });
  }

  accepter(id: string): Observable<DocumentJuridique> {
    return this.http.post<DocumentJuridique>(`${this.url}/verification/documents/${id}/accept`, {});
  }

  refuser(id: string, motif: string): Observable<DocumentJuridique> {
    return this.http.post<DocumentJuridique>(`${this.url}/verification/documents/${id}/reject`, { motif });
  }

  signer(id: string, avocat?: string): Observable<DocumentJuridique> {
    return this.http.post<DocumentJuridique>(`${this.url}/verification/documents/${id}/sign`, avocat ? { avocat } : {});
  }
}

/** Télécharge un Blob sous le nom donné (export PDF). */
export function telechargerBlob(blob: Blob, nom: string): void {
  const url = URL.createObjectURL(blob);
  const lien = document.createElement('a');
  lien.href = url;
  lien.download = nom;
  lien.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
