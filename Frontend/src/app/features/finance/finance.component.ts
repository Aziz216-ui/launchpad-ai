import { ChangeDetectionStrategy, Component, ViewEncapsulation, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { NotificationService } from '../../core/notifications/notification.service';
import { BadgeComponent } from '../../shared/components/badge.component';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { ProjetPlateformeSaisie } from './models/finance.models';
import { ROLES_PROJET } from './models/libelles';
import { texteErreur } from './services/erreurs';
import { FinanceStore } from './services/finance-store.service';

/**
 * Racine du module « Finance » : titre, projet courant, onglets, puis l'écran choisi.
 *
 * Ses styles (finance.component.scss) ne sont pas encapsulés pour être partagés par les pages
 * du module, mais ils sont tous préfixés par `.finance` : ils ne débordent jamais sur les autres modules.
 */
@Component({
  selector: 'app-finance',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, FormsModule, BadgeComponent, EmptyStateComponent],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'finance' },
  template: `
    <div class="page cadre">
      <nav class="fil-ariane" aria-label="Fil d'Ariane">
        <a routerLink="/">Espace startup</a><span aria-hidden="true">/</span><span class="courant">Finance</span>
      </nav>

      <div class="entete-page">
        <div class="titre">
          @if (financier) {
            <h1>Relecture financière</h1>
            <p>Relisez les prévisions des projets qui vous sont confiés, donnez votre avis et certifiez les documents.</p>
          } @else {
            <h1>Gestion financière</h1>
            <p>Prévoyez votre activité, suivez vos marges et produisez vos documents financiers.</p>
          }
        </div>
        @if (financier) {
          @if (store.mesProjets().length) {
            <label class="champ projet-suivi">
              Projet suivi
              <select name="projetSuivi" [ngModel]="store.projetId()" (ngModelChange)="store.changerProjet($event)">
                @for (p of store.mesProjets(); track p.projetId) {
                  <option [ngValue]="p.projetId">
                    {{ store.titre(p.projetId) }}{{ p.previsionsEnAttente ? ' · ' + p.previsionsEnAttente + ' à valider' : '' }}
                  </option>
                }
              </select>
            </label>
          }
        } @else {
          <div class="projet">
            @if (store.projets().length) {
              <label class="champ">
                Projet
                <select name="projet" [ngModel]="store.projetId()" (ngModelChange)="store.changerProjet($event)">
                  @for (p of store.projets(); track p.id) {
                    <option [ngValue]="p.id">{{ p.titre }}{{ p.secteur ? ' · ' + p.secteur : '' }}</option>
                  }
                </select>
              </label>
            }
            <button type="button" class="btn-secondaire" (click)="creation.set(!creation())" [attr.aria-expanded]="creation()">
              Nouveau projet
            </button>
          </div>
        }
      </div>

      @if (!financier && (creation() || store.aucunProjet())) {
        <form class="carte creation" (ngSubmit)="creer()" novalidate aria-label="Nouveau projet">
          <h2>{{ store.aucunProjet() ? 'Créez votre premier projet' : 'Nouveau projet' }}</h2>
          <p class="note">Le projet est créé sur la plateforme : il sera aussi disponible pour le Co-Fondateur IA et l'étude de marché.</p>
          <div class="grille-creation">
            <label class="champ">
              Nom du projet
              <input name="titre" [(ngModel)]="nouveauTitre" maxlength="255" placeholder="Ex. : Boulangerie bio" required />
            </label>
            <label class="champ">
              Secteur
              <input name="secteur" [(ngModel)]="nouveauSecteur" maxlength="100" placeholder="Ex. : Alimentation" />
            </label>
            <label class="champ">
              Stade
              <select name="stade" [(ngModel)]="nouveauStade">
                <option value="idee">Idée</option>
                <option value="prototype">Prototype</option>
                <option value="lancement">Lancement</option>
                <option value="croissance">Croissance</option>
              </select>
            </label>
          </div>
          @if (erreurCreation(); as m) {
            <div class="bandeau-erreur" role="alert">{{ m }}</div>
          }
          <div class="actions-creation">
            <button type="submit" class="btn-primaire" [disabled]="creationEnCours()">
              {{ creationEnCours() ? 'Création…' : 'Créer le projet' }}
            </button>
            @if (!store.aucunProjet()) {
              <button type="button" class="btn-texte" (click)="creation.set(false)">Annuler</button>
            }
          </div>
        </form>
      }

      @if (store.droits(); as d) {
        @if (d.role !== 'AUCUN') {
          <p class="role-projet">
            Votre rôle sur ce projet : <app-badge [variante]="d.role === 'FINANCIER' ? 'info' : 'neutre'" [petit]="true">{{ roles[d.role] }}</app-badge>
            @if (d.role === 'FINANCIER') { <span class="note">Lecture seule : vous validez les prévisions et certifiez les documents.</span> }
          </p>
        }
      }

      @if (store.projetId()) {
        <nav class="onglets" aria-label="Sections finance">
          @for (onglet of onglets(); track onglet.route) {
            <a [routerLink]="onglet.route" routerLinkActive="actif" ariaCurrentWhenActive="page">{{ onglet.libelle }}</a>
          }
        </nav>
      }
    </div>

    @if (store.aucunProjetConfie()) {
      <div class="page">
        <app-empty-state titre="Aucun projet ne vous a été confié"
          texte="Un entrepreneur doit vous inviter sur son projet avec l'adresse e-mail de votre compte. Ses prévisions et documents apparaîtront ici." />
      </div>
    } @else if (store.projetId()) {
      <router-outlet />
    } @else if (store.erreur(); as erreur) {
      <div class="page"><div class="bandeau-erreur" role="alert">{{ erreur }}</div></div>
    }
  `,
  styles: `
    .cadre {
      padding-bottom: 0 !important;
    }
    .projet {
      display: flex;
      gap: 8px;
      align-items: flex-end;
      flex-wrap: wrap;
    }
    .projet .champ,
    .projet-suivi {
      width: min(100%, 340px);
    }
    .creation {
      margin-bottom: 16px;
    }
    .grille-creation {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 12px;
    }
    .actions-creation {
      display: flex;
      gap: 8px;
      align-items: center;
    }
    .role-projet {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      font-size: 13px;
      color: #5a6a6f;
      margin: 0 0 12px;
    }
    .onglets {
      display: flex;
      gap: 4px;
      border-bottom: 1px solid #e3e8ea;
      overflow-x: auto;
    }
    .onglets a {
      padding: 12px 14px;
      font-size: 13px;
      color: #5a6a6f !important;
      text-decoration: none;
      white-space: nowrap;
      border-bottom: 2px solid transparent;
    }
    .onglets a:hover {
      color: #1f6470 !important;
    }
    .onglets a.actif {
      color: #1f6470 !important;
      font-weight: 600;
      border-bottom-color: #2b7a86;
    }
  `,
  styleUrl: './finance.component.scss',
})
export class FinanceComponent implements OnInit {
  protected readonly store = inject(FinanceStore);
  private readonly notifications = inject(NotificationService);
  protected readonly roles = ROLES_PROJET;
  protected readonly financier = this.store.estFinancier();

  /** Équipe et assistant (qui peut générer des documents) sont réservés au propriétaire du projet. */
  protected readonly onglets = computed(() => {
    const onglets = [
      { route: 'apercu', libelle: "Vue d'ensemble" },
      { route: 'previsions', libelle: 'Prévisions' },
      { route: 'projections', libelle: 'Projections' },
      { route: 'documents', libelle: 'Documents' },
    ];
    if (this.store.peutEcrire()) {
      onglets.push({ route: 'equipe', libelle: 'Équipe' }, { route: 'assistant', libelle: 'Assistant IA' });
    }
    return onglets;
  });

  /** Formulaire « Nouveau projet » (toujours affiché tant que l'entrepreneur n'a aucun projet). */
  protected readonly creation = signal(false);
  protected readonly creationEnCours = signal(false);
  protected readonly erreurCreation = signal<string | null>(null);
  protected nouveauTitre = '';
  protected nouveauSecteur = '';
  protected nouveauStade: ProjetPlateformeSaisie['stade'] = 'idee';

  ngOnInit(): void {
    this.store.demarrer();
  }

  protected creer(): void {
    this.erreurCreation.set(null);
    const titre = this.nouveauTitre.trim();
    if (!titre) {
      this.erreurCreation.set('Donnez un nom à votre projet.');
      return;
    }
    this.creationEnCours.set(true);
    this.store.creerProjet({ titre, secteur: this.nouveauSecteur.trim(), stade: this.nouveauStade }).subscribe({
      next: (projet) => {
        this.notifications.succes(`Projet « ${projet.titre} » créé.`);
        this.nouveauTitre = this.nouveauSecteur = '';
        this.nouveauStade = 'idee';
        this.creation.set(false);
        this.creationEnCours.set(false);
      },
      error: (e: unknown) => {
        this.erreurCreation.set(texteErreur(e));
        this.creationEnCours.set(false);
      },
    });
  }
}
