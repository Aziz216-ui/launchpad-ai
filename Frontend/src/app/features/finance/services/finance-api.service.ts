import { HttpClient, HttpResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import {
  AvisSaisie,
  CommentaireIa,
  DocumentFinancier,
  DocumentResume,
  DocumentSaisie,
  DroitsProjet,
  Ecart,
  FormatExport,
  Marges,
  MembreProjet,
  NotificationFinance,
  Prevision,
  PrevisionSaisie,
  ProjetAccessible,
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

  listerPrevisions(projetId: number): Observable<Prevision[]> {
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

  listerDocuments(projetId: number): Observable<DocumentResume[]> {
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

  /** Certification par le financier invité ; le commentaire est facultatif. */
  certifierDocument(documentId: string, commentaire: string | null): Observable<DocumentFinancier> {
    return this.http.post<DocumentFinancier>(`${this.url}/documents/${documentId}/certification`, { commentaire });
  }

  /** Notifications du projet destinées à l'utilisateur connecté (de la plus récente à la plus ancienne). */
  listerNotifications(projetId: number): Observable<NotificationFinance[]> {
    return this.http.get<NotificationFinance[]>(`${this.url}/projets/${projetId}/notifications`);
  }

  // --- Rôles : droits, projets, financiers invités, avis ----------------------

  droits(projetId: number): Observable<DroitsProjet> {
    return this.http.get<DroitsProjet>(`${this.url}/projets/${projetId}/acces`);
  }

  mesProjets(): Observable<ProjetAccessible[]> {
    return this.http.get<ProjetAccessible[]>(`${this.url}/mes-projets`);
  }

  listerFinanciers(projetId: number): Observable<MembreProjet[]> {
    return this.http.get<MembreProjet[]>(`${this.url}/projets/${projetId}/financiers`);
  }

  inviterFinancier(projetId: number, email: string): Observable<MembreProjet> {
    return this.http.post<MembreProjet>(`${this.url}/projets/${projetId}/financiers`, { email });
  }

  retirerFinancier(projetId: number, email: string): Observable<void> {
    return this.http.delete<void>(`${this.url}/projets/${projetId}/financiers/${encodeURIComponent(email)}`);
  }

  donnerAvis(previsionId: string, avis: AvisSaisie): Observable<Prevision> {
    return this.http.post<Prevision>(`${this.url}/previsions/${previsionId}/avis`, avis);
  }

  // --- Assistant financier IA -------------------------------------------------

  poserQuestion(projetId: number, message: string): Observable<ReponseAssistant> {
    return this.http.post<ReponseAssistant>(`${this.url}/projets/${projetId}/assistant`, { message });
  }
}
