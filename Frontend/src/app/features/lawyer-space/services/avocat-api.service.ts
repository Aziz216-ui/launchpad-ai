import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, forkJoin, map, of, switchMap } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { AuthService } from '../../../core/services/auth.service';
import {
  Avocat,
  ClientAvocat,
  DemandeRevue,
  DocumentJuridiqueDetail,
  DocumentJuridiqueResume,
  MessageAvocat,
  PREFIXE_DOCUMENT,
  StatutDemande,
} from '../models/avocat.models';

/** Une relation entrepreneur ↔ avocat : l'avocat et la fiche client de l'entrepreneur chez lui. */
export interface Relation {
  avocat: Avocat;
  client: ClientAvocat;
}

/**
 * Appels de l'espace avocat, pour les deux rôles.
 * Les services avocat identifient l'avocat par l'en-tête X-Lawyer-Id (son identifiant de connexion) :
 * l'avocat connecté envoie le sien, l'entrepreneur celui de l'avocat qu'il contacte.
 */
@Injectable({ providedIn: 'root' })
export class AvocatApiService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly lawyer = environment.lawyerApiUrl;

  private entetes(avocat?: string): { headers: HttpHeaders } {
    const u = this.auth.currentUserValue;
    const id = avocat ?? (u?.role === 'LAWYER' ? u.username : '');
    return { headers: new HttpHeaders({ 'X-Lawyer-Id': id }) };
  }

  utilisateur() {
    return this.auth.currentUserValue;
  }

  nomUtilisateur(): string {
    const u = this.auth.currentUserValue;
    return `${u?.first_name ?? ''} ${u?.last_name ?? ''}`.trim() || u?.username || 'Utilisateur';
  }

  // --- Annuaire et relations (entrepreneur) ------------------------------------------------------

  /** Tous les utilisateurs de rôle LAWYER inscrits sur la plateforme. */
  avocats(): Observable<Avocat[]> {
    return this.http.get<Avocat[]>(`${environment.userApiUrl}/lawyers/`);
  }

  /** Fiche client de l'entrepreneur connecté chez cet avocat, si elle existe. */
  trouverClient(avocat: string): Observable<ClientAvocat | null> {
    const email = this.auth.currentUserValue?.email ?? '';
    if (!email) return of(null);
    const params = new HttpParams().set('query', email);
    return this.http
      .get<ClientAvocat[]>(`${this.lawyer}/clients`, { params, ...this.entetes(avocat) })
      .pipe(map((clients) => clients.find((c) => c.email?.toLowerCase() === email.toLowerCase()) ?? null));
  }

  /** Fiche client existante ou créée au premier contact (message ou demande). */
  assurerClient(avocat: string): Observable<ClientAvocat> {
    return this.trouverClient(avocat).pipe(
      switchMap((existant) => {
        if (existant) return of(existant);
        const u = this.auth.currentUserValue;
        return this.http.post<ClientAvocat>(
          `${this.lawyer}/clients`,
          {
            firstName: u?.first_name?.trim() || u?.username || 'Entrepreneur',
            lastName: u?.last_name?.trim() || '-',
            email: u?.email,
            phone: u?.phone_number || '',
            notes: 'Fiche créée depuis LaunchPad AI (premier contact)',
          },
          this.entetes(avocat),
        );
      }),
    );
  }

  /** Avocats déjà contactés par l'entrepreneur (une fiche client existe chez eux). */
  relations(avocats: Avocat[]): Observable<Relation[]> {
    if (!avocats.length) return of([]);
    return forkJoin(
      avocats.map((a) =>
        this.trouverClient(a.username).pipe(
          map((client) => (client ? { avocat: a, client } : null)),
          catchError(() => of(null)),
        ),
      ),
    ).pipe(map((r) => r.filter((x): x is Relation => !!x)));
  }

  /** Demandes de l'entrepreneur, tous avocats confondus. */
  demandesEntrepreneur(relations: Relation[]): Observable<{ relation: Relation; demande: DemandeRevue }[]> {
    if (!relations.length) return of([]);
    return forkJoin(
      relations.map((r) =>
        this.http
          .get<DemandeRevue[]>(`${this.lawyer}/reviews`, { params: { clientId: r.client.id }, ...this.entetes(r.avocat.username) })
          .pipe(
            map((ds) => ds.map((demande) => ({ relation: r, demande }))),
            catchError(() => of([])),
          ),
      ),
    ).pipe(map((listes) => listes.flat().sort((a, b) => b.demande.createdAt.localeCompare(a.demande.createdAt))));
  }

  /**
   * « Demander un avocat » : fiche client, envoi en validation si le document est un brouillon (l'avocat
   * pourra corriger ses clauses), demande de revue, puis la question en premier commentaire.
   */
  demanderAvocat(avocat: string, document: DocumentJuridiqueResume, question: string): Observable<DemandeRevue> {
    const u = this.auth.currentUserValue;
    const envoiEnValidation: Observable<unknown> =
      document.statut === 'BROUILLON'
        ? this.http.post(`${environment.legalApiUrl}/documents/${document.id}/validation-requests`, { clientId: u?.username ?? 'entrepreneur' })
        : of(null);
    return this.assurerClient(avocat).pipe(
      switchMap((client: ClientAvocat) =>
        envoiEnValidation.pipe(
          switchMap(() =>
            this.http.post<DemandeRevue>(
              `${this.lawyer}/reviews`,
              { clientId: client.id, documentTitle: document.titre, documentType: document.type, documentUrl: PREFIXE_DOCUMENT + document.id },
              this.entetes(avocat),
            ),
          ),
        ),
      ),
      switchMap((demande: DemandeRevue) => this.commenter(avocat, demande.id, `${this.nomUtilisateur()} (entrepreneur)`, question, false)),
    );
  }

  // --- Demandes (les deux rôles) ----------------------------------------------------------------

  /** Demandes reçues par l'avocat connecté. */
  demandesAvocat(statut?: StatutDemande): Observable<DemandeRevue[]> {
    let params = new HttpParams();
    if (statut) params = params.set('status', statut);
    return this.http.get<DemandeRevue[]>(`${this.lawyer}/reviews`, { params, ...this.entetes() });
  }

  demande(id: number, avocat?: string): Observable<DemandeRevue> {
    return this.http.get<DemandeRevue>(`${this.lawyer}/reviews/${id}`, this.entetes(avocat));
  }

  commenter(avocat: string | undefined, id: number, auteur: string, texte: string, correction: boolean): Observable<DemandeRevue> {
    return this.http.post<DemandeRevue>(
      `${this.lawyer}/reviews/${id}/comments`,
      { author: auteur, commentText: texte, correctionRequested: correction },
      this.entetes(avocat),
    );
  }

  /** Décision de l'avocat : IN_PROGRESS (accepter), REJECTED (refuser / rejeter), APPROVED, NEEDS_CORRECTION. */
  decider(id: number, status: StatutDemande, reason: string): Observable<DemandeRevue> {
    return this.http.patch<DemandeRevue>(
      `${this.lawyer}/reviews/${id}/decision`,
      { status, reason, reviewerName: `Me ${this.nomUtilisateur()}` },
      this.entetes(),
    );
  }

  // --- Clients et messages ------------------------------------------------------------------------

  clientsAvocat(): Observable<ClientAvocat[]> {
    return this.http.get<ClientAvocat[]>(`${this.lawyer}/clients`, this.entetes());
  }

  messages(avocat: string | undefined, clientId: number): Observable<MessageAvocat[]> {
    return this.http
      .get<MessageAvocat[]>(`${this.lawyer}/messages/${clientId}`, this.entetes(avocat))
      .pipe(map((ms) => [...ms].sort((a, b) => a.sentAt.localeCompare(b.sentAt))));
  }

  tousMessagesAvocat(): Observable<MessageAvocat[]> {
    return this.http.get<MessageAvocat[]>(`${this.lawyer}/messages`, this.entetes());
  }

  envoyerMessage(avocat: string | undefined, clientId: number, contenu: string): Observable<MessageAvocat> {
    const role = this.auth.currentUserValue?.role === 'LAWYER' ? 'LAWYER' : 'CLIENT';
    return this.http.post<MessageAvocat>(
      `${this.lawyer}/messages`,
      { clientId, senderType: role, subject: `Message de ${this.nomUtilisateur()}`, content: contenu },
      this.entetes(avocat),
    );
  }

  marquerLu(avocat: string | undefined, id: number): Observable<unknown> {
    return this.http.patch(`${this.lawyer}/messages/${id}/read`, {}, this.entetes(avocat)).pipe(catchError(() => of(null)));
  }

  // --- Documents juridiques (Legal-Service) ---------------------------------------------------

  /** Documents juridiques de l'entrepreneur connecté (espace ent-<username> du module Juridique). */
  mesDocuments(): Observable<DocumentJuridiqueResume[]> {
    const projetId = `ent-${(this.auth.currentUserValue?.username ?? 'anonyme').toLowerCase()}`;
    return this.http.get<DocumentJuridiqueResume[]>(`${environment.legalApiUrl}/documents`, { params: { projetId } });
  }

  documentJuridique(id: string): Observable<DocumentJuridiqueDetail> {
    const chemin = this.auth.currentUserValue?.role === 'LAWYER' ? `verification/documents/${id}` : `documents/${id}`;
    return this.http.get<DocumentJuridiqueDetail>(`${environment.legalApiUrl}/${chemin}`);
  }
}
