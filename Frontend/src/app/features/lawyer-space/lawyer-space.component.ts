import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { LawyerService } from '../../core/services/lawyer.service';
import { AuthService, User } from '../../core/services/auth.service';
import { Client, Message, DocReview, LawyerProfile } from '../../core/models/lawyer.models';

type TabType = 'avocats' | 'messages' | 'docreviews' | 'clients';

@Component({
  selector: 'app-lawyer-space',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="lawyer-container">
      <!-- Breadcrumb -->
      <div class="breadcrumb">
        {{ isLawyer ? 'Espace Avocat / Clients & Dossiers' : 'Espace Startup / Accompagnement Avocat' }}
      </div>

      <!-- Page Header -->
      <div class="header-row">
        <div class="header-titles">
          <h1 class="page-title">
            {{ isLawyer ? 'Espace Avocat - Gestion Cabinet' : 'Espace Avocat & Experts Juridiques' }}
          </h1>
          <p class="page-subtitle">
            {{ isLawyer 
              ? 'Consultez vos clients, répondez aux messages et effectuez vos revues contractuelles en direct.' 
              : 'Trouvez un avocat expert, échangez par messagerie sécurisée et faites réviser vos contrats.' }}
          </p>
        </div>

        <div class="header-actions">
          <button class="btn btn-secondary" (click)="openQuickExport()">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>
            </svg>
            Exporter
          </button>
          
          <button *ngIf="isLawyer" class="btn btn-primary" (click)="showNewClientModal = true">
            + Nouveau Client
          </button>

          <button *ngIf="!isLawyer" class="btn btn-primary" (click)="showNewDocModal = true">
            + Déposer un contrat
          </button>
        </div>
      </div>

      <!-- TABS NAVIGATION -->
      <div class="tabs-nav">
        <!-- If Startup Founder -->
        <ng-container *ngIf="!isLawyer">
          <button class="tab-item" [class.active]="activeTab === 'avocats'" (click)="activeTab = 'avocats'">
            Avocats
            <span class="tab-pill tab-pill-teal">{{ lawyers.length }}</span>
          </button>
          <button class="tab-item" [class.active]="activeTab === 'messages'" (click)="activeTab = 'messages'">
            Messagerie
            <span class="tab-pill">{{ messages.length }}</span>
          </button>
          <button class="tab-item" [class.active]="activeTab === 'docreviews'" (click)="activeTab = 'docreviews'">
            Revue documentaire
            <span class="tab-pill">{{ docReviews.length }}</span>
          </button>
        </ng-container>

        <!-- If Lawyer -->
        <ng-container *ngIf="isLawyer">
          <button class="tab-item" [class.active]="activeTab === 'clients'" (click)="activeTab = 'clients'">
            Clients & Dossiers
            <span class="tab-pill tab-pill-teal">{{ clients.length }}</span>
          </button>
          <button class="tab-item" [class.active]="activeTab === 'messages'" (click)="activeTab = 'messages'">
            Messagerie Directe
            <span class="tab-pill">{{ messages.length }}</span>
          </button>
          <button class="tab-item" [class.active]="activeTab === 'docreviews'" (click)="activeTab = 'docreviews'">
            Revues Documentaires
            <span class="tab-pill">{{ docReviews.length }}</span>
          </button>
        </ng-container>
      </div>

      <!-- TAB 1: LISTE D'AVOCATS (Pour le Fondateur de Startup) -->
      <div *ngIf="activeTab === 'avocats' && !isLawyer" class="lawyers-section">
        <div class="lawyers-grid">
          <div class="lawyer-card" *ngFor="let law of lawyers">
            <div class="lawyer-card-top">
              <div class="lawyer-avatar">{{ law.avatarText }}</div>
              <div class="lawyer-main-info">
                <h3 class="lawyer-name">{{ law.fullName }}</h3>
                <div class="lawyer-specialty">{{ law.specialty }}</div>
                <div class="lawyer-rating">
                  ⭐ <strong>{{ law.rating }}</strong> <span>({{ law.reviewCount }} avis vérifiés)</span>
                </div>
              </div>
            </div>

            <p class="lawyer-desc">{{ law.description }}</p>

            <div class="lawyer-badges-row">
              <span class="badge-loc">📍 {{ law.location }}</span>
              <span class="badge-rate">💰 {{ law.hourlyRate }}</span>
              <span class="badge-avail">🟢 {{ law.availability }}</span>
            </div>

            <div class="lawyer-actions">
              <button class="btn btn-primary btn-grow" (click)="openChatWith(law)">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
                Envoyer un Message
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- TAB 2: CLIENTS & DOSSIERS (Vue Avocat) -->
      <div *ngIf="activeTab === 'clients' && isLawyer" class="card">
        <div class="card-header">
          <div>
            <h3 class="card-title">Portefeuille Clients & Dossiers Suivis</h3>
            <p class="card-subtitle">Microservice Lawyer-Client-Service (:8082)</p>
          </div>
          <button class="btn btn-sm btn-primary" (click)="showNewClientModal = true">+ Ajouter un client</button>
        </div>

        <table class="data-table">
          <thead>
            <tr>
              <th>Client / Entreprise</th>
              <th>Email</th>
              <th>Téléphone</th>
              <th>Statut</th>
              <th>Date d'inscription</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let c of clients">
              <td>
                <strong>{{ c.fullName }}</strong>
                <div class="text-sub">{{ c.companyName }}</div>
              </td>
              <td>{{ c.email }}</td>
              <td>{{ c.phone || '-' }}</td>
              <td><span class="badge badge-green">{{ c.status }}</span></td>
              <td>{{ c.createdAt | date:'mediumDate' }}</td>
              <td>
                <button class="action-pill" (click)="openChatForClient(c)">Ouvrir chat</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- TAB 3: MESSAGERIE DIRECTE -->
      <div *ngIf="activeTab === 'messages'" class="card">
        <div class="card-header">
          <div>
            <h3 class="card-title">Messagerie Directe Sécurisée</h3>
            <p class="card-subtitle">Microservice Lawyer-Message-Service (:8084)</p>
          </div>
        </div>

        <div class="chat-container">
          <div class="message-feed">
            <div class="chat-bubble" *ngFor="let m of messages" [class.outgoing]="(isLawyer && m.senderType === 'LAWYER') || (!isLawyer && m.senderType === 'CLIENT')">
              <div class="bubble-header">
                <strong>{{ m.clientName || m.senderType }}</strong>
                <span>{{ m.sentAt | date:'shortTime' }}</span>
              </div>
              <div class="bubble-content">{{ m.content }}</div>
            </div>
          </div>

          <div class="chat-input-row">
            <input 
              type="text" 
              [(ngModel)]="newMessageContent" 
              [placeholder]="isLawyer ? 'Répondre au client...' : 'Poser une question juridique à votre avocat...'" 
              (keyup.enter)="sendMessage()" 
            />
            <button class="btn btn-primary" (click)="sendMessage()">Envoyer</button>
          </div>
        </div>
      </div>

      <!-- TAB 4: REVUE DOCUMENTAIRE -->
      <div *ngIf="activeTab === 'docreviews'" class="card">
        <div class="card-header">
          <div>
            <h3 class="card-title">Revues Documentaires & Contrats</h3>
            <p class="card-subtitle">Microservice Lawyer-DocReview-Service (:8086)</p>
          </div>
          <button class="btn btn-sm btn-primary" (click)="showNewDocModal = true">+ Déposer un contrat</button>
        </div>

        <table class="data-table">
          <thead>
            <tr>
              <th>Document</th>
              <th>{{ isLawyer ? 'Client' : 'Demandeur' }}</th>
              <th>Catégorie</th>
              <th>Statut</th>
              <th>Avis / Décision</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let d of docReviews">
              <td><strong>{{ d.documentTitle }}</strong></td>
              <td>{{ d.clientName }}</td>
              <td><span class="category-pill">{{ d.documentType }}</span></td>
              <td>
                <span class="badge" [ngClass]="d.status === 'APPROVED' ? 'badge-green' : (d.status === 'CHANGES_REQUESTED' ? 'badge-amber' : 'badge-blue')">
                  {{ d.status }}
                </span>
              </td>
              <td>
                <span class="text-sub">{{ d.decisionNotes || 'En cours d’analyse' }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- ADD CLIENT MODAL -->
      <div class="modal-overlay" *ngIf="showNewClientModal">
        <div class="modal-card">
          <div class="modal-header">
            <h3>Ajouter un Client / Dossier</h3>
            <button class="close-btn" (click)="showNewClientModal = false">×</button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label>Nom complet du représentant</label>
              <input type="text" [(ngModel)]="newClient.fullName" placeholder="Ex: Amira Ben Ali" />
            </div>
            <div class="form-group">
              <label>Email</label>
              <input type="email" [(ngModel)]="newClient.email" placeholder="amira@nextpay.tn" />
            </div>
            <div class="form-group">
              <label>Startup / Société</label>
              <input type="text" [(ngModel)]="newClient.companyName" placeholder="NextPay SARL" />
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" (click)="showNewClientModal = false">Annuler</button>
            <button class="btn btn-primary" (click)="saveClient()">Enregistrer</button>
          </div>
        </div>
      </div>

      <!-- SUBMIT DOC MODAL -->
      <div class="modal-overlay" *ngIf="showNewDocModal">
        <div class="modal-card">
          <div class="modal-header">
            <h3>Soumettre un Document pour Revue</h3>
            <button class="close-btn" (click)="showNewDocModal = false">×</button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label>Titre du document</label>
              <input type="text" [(ngModel)]="newDocTitle" placeholder="Ex: Term Sheet Seed V1" />
            </div>
            <div class="form-group">
              <label>Type de document</label>
              <select [(ngModel)]="newDocType" class="select-field">
                <option value="Investissement">Investissement (Term Sheet, BSA)</option>
                <option value="Commercial">Commercial (CGU, CGV, SaaS)</option>
                <option value="Propriété Intellectuelle">Propriété Intellectuelle & Brevet</option>
                <option value="Social">Droit du travail & Contrats</option>
              </select>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" (click)="showNewDocModal = false">Annuler</button>
            <button class="btn btn-primary" (click)="saveDoc()">Soumettre le document</button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .lawyer-container {
      padding: 32px 36px;
      display: flex;
      flex-direction: column;
      gap: 22px;
      max-width: 1400px;
      margin: 0 auto;
    }

    .breadcrumb {
      font-size: 12.5px;
      color: var(--text-light);
      font-weight: 500;
    }

    .header-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .page-title {
      font-size: 24px;
      font-weight: 800;
      color: var(--text-main);
      letter-spacing: -0.5px;
    }

    .page-subtitle {
      font-size: 13.5px;
      color: var(--text-muted);
      margin-top: 4px;
    }

    .header-actions {
      display: flex;
      gap: 12px;
    }

    .btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 9px 18px;
      border-radius: var(--radius-sm);
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s ease;

      &.btn-primary {
        background: var(--primary-teal);
        color: white;
        box-shadow: 0 2px 4px rgba(13, 148, 136, 0.2);
        &:hover { background: var(--primary-teal-hover); }
      }

      &.btn-secondary {
        background: white;
        border: 1px solid var(--border-color);
        color: var(--text-main);
        &:hover { background: #f8fafc; }
      }

      &.btn-sm {
        padding: 6px 12px;
        font-size: 12px;
      }

      &.btn-grow {
        flex: 1;
        justify-content: center;
      }
    }

    .tabs-nav {
      display: flex;
      align-items: center;
      gap: 8px;
      border-bottom: 1px solid var(--border-color);
    }

    .tab-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 11px 18px;
      font-size: 13.5px;
      font-weight: 500;
      color: var(--text-muted);
      border-bottom: 2px solid transparent;
      cursor: pointer;

      &:hover { color: var(--text-main); }

      &.active {
        color: var(--primary-teal);
        border-bottom-color: var(--primary-teal);
        font-weight: 700;
      }
    }

    .tab-pill {
      font-size: 11px;
      font-weight: 700;
      padding: 2px 7px;
      border-radius: 12px;
      background: #f1f5f9;
      color: var(--text-muted);

      &.tab-pill-teal {
        background: var(--primary-teal-light);
        color: var(--primary-teal-dark);
      }
    }

    /* LAWYERS DIRECTORY GRID */
    .lawyers-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 22px;
    }

    .lawyer-card {
      background: white;
      border: 1px solid var(--border-color);
      border-radius: var(--radius-md);
      padding: 24px;
      display: flex;
      flex-direction: column;
      gap: 16px;
      box-shadow: var(--shadow-sm);
      transition: transform 0.15s ease, box-shadow 0.15s ease;

      &:hover {
        transform: translateY(-2px);
        box-shadow: var(--shadow-md);
      }
    }

    .lawyer-card-top {
      display: flex;
      gap: 14px;
    }

    .lawyer-avatar {
      width: 48px;
      height: 48px;
      border-radius: 12px;
      background: linear-gradient(135deg, #0d9488 0%, #0284c7 100%);
      color: white;
      font-size: 16px;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .lawyer-main-info {
      display: flex;
      flex-direction: column;
    }

    .lawyer-name {
      font-size: 15px;
      font-weight: 700;
      color: var(--text-main);
    }

    .lawyer-specialty {
      font-size: 12px;
      color: var(--primary-teal);
      font-weight: 600;
    }

    .lawyer-rating {
      font-size: 12px;
      color: var(--text-muted);
      margin-top: 3px;
      span { color: var(--text-light); }
    }

    .lawyer-desc {
      font-size: 12.5px;
      color: var(--text-muted);
      line-height: 1.45;
      flex: 1;
    }

    .lawyer-badges-row {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      font-size: 11.5px;
      font-weight: 500;
      color: var(--text-muted);

      span {
        background: #f8fafc;
        padding: 4px 8px;
        border-radius: 6px;
        border: 1px solid var(--border-light);
      }
    }

    .lawyer-actions {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-top: 4px;
    }

    /* CARD & DATA TABLES */
    .card {
      background: white;
      border: 1px solid var(--border-color);
      border-radius: var(--radius-md);
      padding: 24px;
      box-shadow: var(--shadow-sm);
    }

    .card-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      margin-bottom: 20px;
    }

    .card-title {
      font-size: 15px;
      font-weight: 700;
      color: var(--text-main);
    }

    .card-subtitle {
      font-size: 12px;
      color: var(--text-light);
      margin-top: 2px;
    }

    .data-table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
      font-size: 13px;

      th {
        padding: 12px 14px;
        color: var(--text-light);
        font-weight: 600;
        border-bottom: 1px solid var(--border-color);
        font-size: 11.5px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      td {
        padding: 14px;
        border-bottom: 1px solid var(--border-light);
        color: var(--text-main);
      }
    }

    .text-sub {
      font-size: 11.5px;
      color: var(--text-light);
    }

    .badge {
      font-size: 11px;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: 12px;
      display: inline-block;

      &.badge-green { background: #ecfdf5; color: #059669; }
      &.badge-blue { background: #eff6ff; color: #2563eb; }
      &.badge-amber { background: #fffbeb; color: #d97706; }
    }

    .category-pill {
      font-size: 11px;
      background: #f1f5f9;
      color: var(--text-muted);
      padding: 3px 8px;
      border-radius: 4px;
      font-weight: 600;
    }

    .link-teal {
      color: var(--primary-teal);
      text-decoration: none;
      font-weight: 600;
      &:hover { text-decoration: underline; }
    }

    .action-pill {
      font-size: 11.5px;
      font-weight: 600;
      color: var(--primary-teal);
      background: var(--primary-teal-light);
      padding: 4px 10px;
      border-radius: 6px;
      cursor: pointer;
      &:hover { background: #ccfbf1; }
    }

    /* CHAT */
    .chat-container {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .message-feed {
      display: flex;
      flex-direction: column;
      gap: 12px;
      max-height: 400px;
      overflow-y: auto;
      padding: 12px;
      background: #f8fafc;
      border-radius: var(--radius-sm);
    }

    .chat-bubble {
      max-width: 65%;
      padding: 12px 16px;
      border-radius: 12px;
      background: white;
      border: 1px solid var(--border-color);
      align-self: flex-start;

      &.outgoing {
        align-self: flex-end;
        background: var(--primary-teal);
        color: white;
        border-color: var(--primary-teal);

        .bubble-header strong { color: white; }
        .bubble-header span { color: #ccfbf1; }
      }
    }

    .bubble-header {
      display: flex;
      justify-content: space-between;
      font-size: 11.5px;
      gap: 14px;
      margin-bottom: 4px;
      color: var(--text-muted);
    }

    .bubble-content {
      font-size: 13px;
      line-height: 1.4;
    }

    .chat-input-row {
      display: flex;
      gap: 12px;

      input {
        flex: 1;
        padding: 10px 16px;
        border: 1px solid var(--border-color);
        border-radius: var(--radius-sm);
        outline: none;
        &:focus { border-color: var(--primary-teal); }
      }
    }

    /* MODAL */
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(15, 23, 42, 0.45);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 100;
    }

    .modal-card {
      background: white;
      border-radius: var(--radius-md);
      width: 480px;
      padding: 24px;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 18px;
      h3 { font-size: 16px; font-weight: 700; color: var(--text-main); }
    }

    .close-btn {
      font-size: 20px;
      color: var(--text-light);
      cursor: pointer;
      &:hover { color: var(--text-main); }
    }

    .modal-body {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 6px;

      label { font-size: 12px; font-weight: 600; color: var(--text-muted); }
      input, .select-field {
        padding: 9px 12px;
        border: 1px solid var(--border-color);
        border-radius: var(--radius-sm);
        outline: none;
        font-size: 13px;
        &:focus { border-color: var(--primary-teal); }
      }
    }

    .modal-footer {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      margin-top: 20px;
    }
  `]
})
export class LawyerSpaceComponent implements OnInit {
  isLawyer = false;
  activeTab: TabType = 'avocats';

  lawyers: LawyerProfile[] = [];
  clients: Client[] = [];
  messages: Message[] = [];
  docReviews: DocReview[] = [];

  // Add Client Modal
  showNewClientModal = false;
  newClient: Partial<Client> = { fullName: '', email: '', companyName: '' };

  // New Doc Modal
  showNewDocModal = false;
  newDocTitle = '';
  newDocType = 'Investissement';

  newMessageContent = '';

  constructor(
    private lawyerService: LawyerService,
    private authService: AuthService,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.authService.currentUser$.subscribe(user => {
      this.isLawyer = user?.role === 'lawyer';
      this.activeTab = this.isLawyer ? 'clients' : 'avocats';
    });

    this.route.queryParams.subscribe(params => {
      if (params['tab']) {
        this.activeTab = params['tab'] as TabType;
      }
    });

    this.loadData();
  }

  loadData(): void {
    this.lawyerService.getLawyers().subscribe(l => this.lawyers = l);
    this.lawyerService.getClients().subscribe(c => this.clients = c);
    this.lawyerService.getMessages().subscribe(m => this.messages = m);
    this.lawyerService.getDocReviews().subscribe(d => this.docReviews = d);
  }

  openChatWith(lawyer: LawyerProfile): void {
    this.activeTab = 'messages';
  }

  openChatForClient(client: Client): void {
    this.activeTab = 'messages';
  }

  sendMessage(): void {
    if (!this.newMessageContent.trim()) return;
    this.lawyerService.sendMessage({
      clientId: 1,
      clientName: this.isLawyer ? 'Maître Karoui' : 'Amira Ben Ali',
      senderType: this.isLawyer ? 'LAWYER' : 'CLIENT',
      content: this.newMessageContent
    }).subscribe(() => {
      this.newMessageContent = '';
      this.lawyerService.getMessages().subscribe(m => this.messages = m);
    });
  }

  saveClient(): void {
    if (!this.newClient.fullName || !this.newClient.email) return;
    this.lawyerService.createClient(this.newClient).subscribe(() => {
      this.showNewClientModal = false;
      this.newClient = { fullName: '', email: '', companyName: '' };
      this.lawyerService.getClients().subscribe(c => this.clients = c);
    });
  }

  saveDoc(): void {
    if (!this.newDocTitle) return;
    this.lawyerService.submitDocReview({
      clientId: 1,
      clientName: this.isLawyer ? 'Cabinet Conseil' : 'Amira Ben Ali (NextPay)',
      documentTitle: this.newDocTitle,
      documentType: this.newDocType
    }).subscribe(() => {
      this.showNewDocModal = false;
      this.newDocTitle = '';
      this.lawyerService.getDocReviews().subscribe(d => this.docReviews = d);
    });
  }

  openQuickExport(): void {
    alert('Rapport juridique exporté avec succès (PDF / Excel).');
  }
}
