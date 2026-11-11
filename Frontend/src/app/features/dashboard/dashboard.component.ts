import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService, User } from '../../core/services/auth.service';
import { LawyerService } from '../../core/services/lawyer.service';
import { Client, DocReview, LawyerProfile } from '../../core/models/lawyer.models';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="dashboard-container">
      <!-- Breadcrumb -->
      <div class="breadcrumb">LaunchPad AI / Tableau de bord</div>

      <!-- Welcome Banner -->
      <div class="welcome-banner">
        <div class="welcome-text">
          <h1 class="welcome-title">Bienvenue, {{ currentUser?.first_name || 'Amira' }} {{ currentUser?.last_name || currentUser?.username || 'Ben Ali' }} 👋</h1>
          <p class="welcome-subtitle">
            {{ isLawyer ? 'Voici l’état global de votre cabinet et des dossiers startups suivis.' : 'Accédez aux experts juridiques et suivez la revue de vos contrats en direct.' }}
          </p>
        </div>
        <div class="welcome-actions">
          <a routerLink="/lawyer" class="btn btn-primary">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="m14 14 1:1m-6-6 1:1"/><path d="m16 8 3-3a1.414 1.414 0 0 1 2 2l-3 3"/>
              <path d="m7 17-3 3a1.414 1.414 0 0 1-2-2l3-3"/><path d="m13 15 5-5-3-3-5 5Z"/><path d="m2 22 4-4"/>
            </svg>
            {{ isLawyer ? 'Ouvrir Espace Cabinet' : 'Consulter les Avocats' }}
          </a>
        </div>
      </div>

      <!-- Stats Grid -->
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon-wrapper teal">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          </div>
          <div class="stat-content">
            <div class="stat-label">{{ isLawyer ? 'Clients suivis' : 'Avocats certifiés' }}</div>
            <div class="stat-val">{{ isLawyer ? clients.length : lawyers.length }}</div>
            <div class="stat-badge success">Disponibles</div>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon-wrapper amber">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
          </div>
          <div class="stat-content">
            <div class="stat-label">Messagerie directe</div>
            <div class="stat-val">Active</div>
            <div class="stat-badge warning">Temps réel</div>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon-wrapper purple">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" x2="8" y1="13" y2="13"/><line x1="16" x2="8" y1="17" y2="17"/>
            </svg>
          </div>
          <div class="stat-content">
            <div class="stat-label">Revues documentaires</div>
            <div class="stat-val">{{ docReviews.length }}</div>
            <div class="stat-badge neutral">Dossiers déposés</div>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon-wrapper blue">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
          </div>
          <div class="stat-content">
            <div class="stat-label">Sécurité & IAM</div>
            <div class="stat-val">Keycloak</div>
            <div class="stat-badge info">Synchronisé</div>
          </div>
        </div>
      </div>

      <!-- Dashboard Columns -->
      <div class="dashboard-columns">
        <!-- Left: Microservices Active Health -->
        <div class="dash-card">
          <div class="card-header">
            <div>
              <h3 class="card-title">Microservices LaunchPad AI</h3>
              <p class="card-subtitle">Architecture découplée (RabbitMQ + Eureka Discovery)</p>
            </div>
            <span class="pulse-indicator">
              <span class="pulse-dot"></span> Système actif
            </span>
          </div>

          <div class="service-status-list">
            <div class="service-status-item">
              <div class="service-meta">
                <span class="service-name">Lawyer-Client-Service</span>
                <span class="service-port">Port 8082 • PostgreSQL lawyer_client_db</span>
              </div>
              <span class="status-pill green">En ligne</span>
            </div>

            <div class="service-status-item">
              <div class="service-meta">
                <span class="service-name">Lawyer-Message-Service</span>
                <span class="service-port">Port 8084 • PostgreSQL lawyer_message_db</span>
              </div>
              <span class="status-pill green">En ligne</span>
            </div>

            <div class="service-status-item">
              <div class="service-meta">
                <span class="service-name">Lawyer-DocReview-Service</span>
                <span class="service-port">Port 8086 • PostgreSQL lawyer_docreview_db</span>
              </div>
              <span class="status-pill green">En ligne</span>
            </div>

            <div class="service-status-item">
              <div class="service-meta">
                <span class="service-name">Keycloak & User-Service</span>
                <span class="service-port">Port 8001 / 8080 • OIDC Realm LaunchPad</span>
              </div>
              <span class="status-pill green">Connecté</span>
            </div>
          </div>
        </div>

        <!-- Right: Lawyers Directory / Doc reviews quick access -->
        <div class="dash-card">
          <div class="card-header">
            <div>
              <h3 class="card-title">{{ isLawyer ? 'Derniers Contrats en Revue' : 'Avocats Recommandés' }}</h3>
              <p class="card-subtitle">{{ isLawyer ? 'Contrats transmis par les startups' : 'Disponibles immédiatement par messagerie' }}</p>
            </div>
            <a routerLink="/lawyer" class="view-all-link">Consulter tout →</a>
          </div>

          <!-- If founder: show top lawyers -->
          <div class="upcoming-list" *ngIf="!isLawyer">
            <div class="upcoming-item" *ngFor="let law of lawyers">
              <div class="avatar-badge">{{ law.avatarText }}</div>
              <div class="info-col">
                <h4 class="client-title">{{ law.fullName }}</h4>
                <p class="topic-desc">{{ law.specialty }}</p>
              </div>
              <div class="action-col">
                <a routerLink="/lawyer" [queryParams]="{tab: 'messages'}" class="join-btn">Écrire</a>
              </div>
            </div>
          </div>

          <!-- If lawyer: show latest doc reviews -->
          <div class="upcoming-list" *ngIf="isLawyer">
            <div class="upcoming-item" *ngFor="let doc of docReviews">
              <div class="doc-icon">📄</div>
              <div class="info-col">
                <h4 class="client-title">{{ doc.documentTitle }}</h4>
                <p class="topic-desc">{{ doc.clientName }} • {{ doc.documentType }}</p>
              </div>
              <div class="action-col">
                <span class="status-pill green">{{ doc.status }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .dashboard-container {
      padding: 32px 36px;
      display: flex;
      flex-direction: column;
      gap: 24px;
      max-width: 1400px;
      margin: 0 auto;
    }

    .breadcrumb {
      font-size: 12.5px;
      color: var(--text-light);
      font-weight: 500;
    }

    .welcome-banner {
      background: linear-gradient(135deg, #ffffff 0%, #f0fdfa 100%);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-lg);
      padding: 28px 32px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      box-shadow: var(--shadow-sm);
    }

    .welcome-title {
      font-size: 24px;
      font-weight: 800;
      color: var(--text-main);
      letter-spacing: -0.5px;
    }

    .welcome-subtitle {
      font-size: 13.5px;
      color: var(--text-muted);
      margin-top: 6px;
    }

    .btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 10px 20px;
      border-radius: var(--radius-sm);
      font-size: 13px;
      font-weight: 600;
      text-decoration: none;
      transition: all 0.15s ease;

      &.btn-primary {
        background: var(--primary-teal);
        color: white;
        box-shadow: 0 2px 4px rgba(13, 148, 136, 0.2);
        &:hover { background: var(--primary-teal-hover); }
      }
    }

    /* Stats Grid */
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 18px;
    }

    .stat-card {
      background: white;
      border: 1px solid var(--border-color);
      border-radius: var(--radius-md);
      padding: 20px;
      display: flex;
      align-items: center;
      gap: 16px;
      box-shadow: var(--shadow-sm);
    }

    .stat-icon-wrapper {
      width: 46px;
      height: 46px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;

      &.teal { background: #e6f6f4; color: #0d9488; }
      &.amber { background: #fffbeb; color: #d97706; }
      &.purple { background: #f3e8ff; color: #9333ea; }
      &.blue { background: #eff6ff; color: #2563eb; }
    }

    .stat-content {
      display: flex;
      flex-direction: column;
    }

    .stat-label {
      font-size: 12px;
      font-weight: 600;
      color: var(--text-muted);
    }

    .stat-val {
      font-size: 24px;
      font-weight: 800;
      color: var(--text-main);
      line-height: 1.2;
    }

    .stat-badge {
      font-size: 11px;
      font-weight: 600;
      margin-top: 4px;

      &.success { color: #059669; }
      &.info { color: #2563eb; }
      &.warning { color: #d97706; }
      &.neutral { color: #64748b; }
    }

    /* Columns */
    .dashboard-columns {
      display: grid;
      grid-template-columns: 1.2fr 1.4fr;
      gap: 22px;
    }

    .dash-card {
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

    .pulse-indicator {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 11.5px;
      font-weight: 600;
      color: #059669;
      background: #ecfdf5;
      padding: 4px 10px;
      border-radius: 20px;
    }

    .pulse-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #10b981;
    }

    /* Service list */
    .service-status-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .service-status-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 14px;
      background: #f8fafc;
      border-radius: var(--radius-sm);
      border: 1px solid var(--border-light);
    }

    .service-meta {
      display: flex;
      flex-direction: column;
    }

    .service-name {
      font-size: 13px;
      font-weight: 600;
      color: var(--text-main);
    }

    .service-port {
      font-size: 11.5px;
      color: var(--text-light);
    }

    .status-pill {
      font-size: 11px;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: 12px;

      &.green {
        background: #ecfdf5;
        color: #059669;
      }
    }

    .view-all-link {
      font-size: 12px;
      font-weight: 700;
      color: var(--primary-teal);
      text-decoration: none;
      &:hover { text-decoration: underline; }
    }

    .upcoming-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .upcoming-item {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 12px 14px;
      border: 1px solid var(--border-light);
      border-radius: var(--radius-sm);
      background: #ffffff;
      transition: all 0.15s ease;

      &:hover {
        background: #f8fafc;
        border-color: var(--border-color);
      }
    }

    .avatar-badge {
      width: 40px;
      height: 40px;
      border-radius: 10px;
      background: var(--primary-teal-light);
      color: var(--primary-teal-dark);
      font-weight: 700;
      font-size: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .doc-icon {
      font-size: 20px;
    }

    .info-col {
      flex: 1;
    }

    .client-title {
      font-size: 13.5px;
      font-weight: 700;
      color: var(--text-main);
    }

    .topic-desc {
      font-size: 12px;
      color: var(--text-muted);
    }

    .join-btn {
      font-size: 11.5px;
      font-weight: 600;
      color: var(--primary-teal);
      background: var(--primary-teal-light);
      padding: 6px 12px;
      border-radius: 6px;
      text-decoration: none;
      &:hover { background: #ccfbf1; }
    }
  `]
})
export class DashboardComponent implements OnInit {
  isLawyer = false;
  currentUser: User | null = null;
  lawyers: LawyerProfile[] = [];
  clients: Client[] = [];
  docReviews: DocReview[] = [];

  constructor(
    private authService: AuthService,
    private lawyerService: LawyerService
  ) {}

  ngOnInit(): void {
    this.authService.currentUser$.subscribe(u => {
      this.currentUser = u;
      this.isLawyer = u?.role === 'LAWYER';
    });

    this.lawyerService.getLawyers().subscribe(l => this.lawyers = l);
    this.lawyerService.getClients().subscribe(c => this.clients = c);
    this.lawyerService.getDocReviews().subscribe(d => this.docReviews = d);
  }
}
