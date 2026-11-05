import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of, catchError, map } from 'rxjs';
import { Client, Message, DocReview, LawyerProfile } from '../models/lawyer.models';
import { AuthService } from './auth.service';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class LawyerService {
  // Tous les appels passent par l'API Gateway (voir environment.ts)
  private clientApi = `${environment.lawyerApiUrl}/clients`;
  private messageApi = `${environment.lawyerApiUrl}/messages`;
  private docReviewApi = `${environment.lawyerApiUrl}/reviews`;
  private usersApi = `${environment.userApiUrl}/lawyers/`;

  constructor(private http: HttpClient, private authService: AuthService) {}

  private getHeaders(): HttpHeaders {
    const user = this.authService.currentUserValue;
    const token = localStorage.getItem('access_token');
    let headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });

    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }

    const lawyerId = user?.role === 'lawyer' ? (user.username || 'lawyer-1') : 'lawyer-1';
    headers = headers.set('X-Lawyer-Id', lawyerId);

    return headers;
  }

  // 1. LAWYERS DIRECTORY (Fetched live from PostgreSQL users table where role='lawyer')
  getLawyers(): Observable<LawyerProfile[]> {
    return this.http.get<any[]>(this.usersApi).pipe(
      map(users => {
        console.log('Live lawyers from PostgreSQL DB:', users);
        if (!users || !Array.isArray(users)) return [];
        return users.map(u => {
          const fullName = `Maître ${u.first_name || ''} ${u.last_name || ''}`.trim() || `Maître ${u.username}`;
          const initials = `${(u.first_name?.[0] || 'M')}${(u.last_name?.[0] || u.username?.[0] || 'A')}`.toUpperCase();
          return {
            id: u.id,
            fullName: fullName,
            specialty: u.username?.includes('karoui') 
              ? 'Droit des Sociétés, M&A & Levée de fonds' 
              : (u.username?.includes('ines') ? 'Propriété Intellectuelle, Brevets & IA' : (u.username?.includes('karim') ? 'Conformité RGPD & Fintech' : 'Droit des Affaires & Tech')),
            rating: 4.9,
            reviewCount: 30 + (u.id * 3),
            avatarText: initials,
            location: 'Tunis / En ligne',
            hourlyRate: '180 TND/h',
            availability: 'Disponible par message',
            description: `Avocat inscrit au barreau (${u.email}). Spécialisé en accompagnement juridique et protection des startups.`
          };
        });
      }),
      catchError(err => {
        console.error('Error fetching lawyers from PostgreSQL users table:', err);
        return of([]);
      })
    );
  }

  // 2. CLIENTS (Lawyer-Client-Service :8082 -> PostgreSQL lawyer_client_db)
  getClients(): Observable<Client[]> {
    return this.http.get<any[]>(this.clientApi, { headers: this.getHeaders() }).pipe(
      map(res => {
        if (!res || !Array.isArray(res)) return [];
        return res.map(item => ({
          id: item.id,
          fullName: item.fullName || `${item.firstName || ''} ${item.lastName || ''}`.trim(),
          email: item.email,
          phone: item.phone,
          companyName: item.company || item.companyName,
          notes: item.notes,
          status: item.status || 'ACTIVE',
          createdAt: item.createdAt
        }));
      }),
      catchError(() => of([]))
    );
  }

  createClient(client: Partial<Client>): Observable<Client> {
    const names = (client.fullName || '').split(' ');
    const firstName = names[0] || 'Client';
    const lastName = names.slice(1).join(' ') || 'Startup';

    const payload = {
      firstName: firstName,
      lastName: lastName,
      email: client.email,
      phone: client.phone || '',
      company: client.companyName || '',
      address: '',
      notes: client.notes || ''
    };

    return this.http.post<any>(this.clientApi, payload, { headers: this.getHeaders() }).pipe(
      map(res => ({
        id: res.id,
        fullName: res.fullName || `${res.firstName} ${res.lastName}`.trim(),
        email: res.email,
        companyName: res.company,
        phone: res.phone,
        status: res.status || 'ACTIVE',
        createdAt: res.createdAt
      }))
    );
  }

  // 3. MESSAGES (Lawyer-Message-Service :8084 -> PostgreSQL lawyer_message_db)
  getMessages(clientId?: number): Observable<Message[]> {
    const url = clientId ? `${this.messageApi}/${clientId}` : this.messageApi;
    return this.http.get<any[]>(url, { headers: this.getHeaders() }).pipe(
      map(res => {
        if (!res || !Array.isArray(res)) return [];
        return res.map(m => ({
          id: m.id,
          clientId: m.clientId,
          clientName: m.clientName,
          senderType: m.senderType,
          content: m.content,
          sentAt: m.sentAt,
          read: m.read ?? m.isRead ?? false
        }));
      }),
      catchError(() => of([]))
    );
  }

  sendMessage(msg: Partial<Message>): Observable<Message> {
    const payload = {
      clientId: msg.clientId || 3,
      senderType: msg.senderType || 'CLIENT',
      subject: 'Consultation Juridique',
      content: msg.content
    };

    return this.http.post<any>(this.messageApi, payload, { headers: this.getHeaders() }).pipe(
      map(res => ({
        id: res.id,
        clientId: res.clientId,
        clientName: res.clientName,
        senderType: res.senderType,
        content: res.content,
        sentAt: res.sentAt,
        read: res.read ?? res.isRead ?? false
      }))
    );
  }

  // 4. DOC REVIEWS (Lawyer-DocReview-Service :8086 -> PostgreSQL lawyer_docreview_db)
  getDocReviews(clientId?: number): Observable<DocReview[]> {
    const url = clientId ? `${this.docReviewApi}?clientId=${clientId}` : this.docReviewApi;
    return this.http.get<any[]>(url, { headers: this.getHeaders() }).pipe(
      map(res => {
        if (!res || !Array.isArray(res)) return [];
        return res.map(d => ({
          id: d.id,
          clientId: d.clientId,
          clientName: d.clientName,
          documentTitle: d.documentTitle,
          documentType: d.documentType,
          fileUrl: d.documentUrl,
          status: d.status,
          decisionNotes: d.decisionNotes,
          submittedAt: d.createdAt,
          reviewedAt: d.reviewedAt
        }));
      }),
      catchError(() => of([]))
    );
  }

  submitDocReview(doc: Partial<DocReview>): Observable<DocReview> {
    const payload = {
      clientId: doc.clientId || 3,
      documentTitle: doc.documentTitle,
      documentType: doc.documentType || 'Commercial',
      documentUrl: doc.fileUrl || 'https://storage.launchpad.ai/docs/' + Date.now() + '.pdf'
    };

    return this.http.post<any>(this.docReviewApi, payload, { headers: this.getHeaders() }).pipe(
      map(res => ({
        id: res.id,
        clientId: res.clientId,
        clientName: res.clientName,
        documentTitle: res.documentTitle,
        documentType: res.documentType,
        status: res.status,
        submittedAt: res.createdAt
      }))
    );
  }
}
