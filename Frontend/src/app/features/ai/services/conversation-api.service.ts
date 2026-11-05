import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { Conversation, ConversationDetail, Message } from '../models/ai.models';

/**
 * Accès REST au Conversation-Service via l'API Gateway.
 * Préfixe : environment.aiApiUrl + /conversations/.
 */
@Injectable()
export class ConversationApiService {
  private readonly http = inject(HttpClient);
  private readonly url = environment.aiApiUrl;

  listerConversations(projetId?: number): Observable<Conversation[]> {
    let params = new HttpParams();
    if (projetId !== undefined) params = params.set('projet_id', String(projetId));
    return this.http.get<any>(`${this.url}/conversations/`, { params }).pipe(
      map((res) => (Array.isArray(res) ? res : (res?.results ?? []))),
    );
  }

  lireConversation(id: number): Observable<ConversationDetail> {
    return this.http.get<ConversationDetail>(`${this.url}/conversations/${id}/`);
  }

  creerConversation(projetId: number, titre: string): Observable<Conversation> {
    return this.http.post<Conversation>(`${this.url}/conversations/`, { projet_id: projetId, titre });
  }

  supprimerConversation(id: number): Observable<void> {
    return this.http.delete<void>(`${this.url}/conversations/${id}/`);
  }

  envoyerMessage(conversationId: number, contenu: string): Observable<Message> {
    return this.http.post<Message>(`${this.url}/conversations/${conversationId}/messages/`, { contenu });
  }
}
