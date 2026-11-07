import { ChangeDetectionStrategy, Component, ViewEncapsulation, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { FinanceStore } from './services/finance-store.service';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Racine du module « Finance » : titre, projet courant, onglets, puis l'écran choisi.
 *
 * Ses styles (finance.component.scss) ne sont pas encapsulés pour être partagés par les pages
 * du module, mais ils sont tous préfixés par `.finance` : ils ne débordent jamais sur les autres modules.
 */
@Component({
  selector: 'app-finance',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, FormsModule],
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
          <h1>Gestion financière</h1>
          <p>Prévoyez votre activité, suivez vos marges et produisez vos documents financiers.</p>
        </div>
        <form class="projet" (ngSubmit)="appliquer()" aria-label="Projet courant">
          <label class="champ">
            Projet (UUID)
            <input name="projet" [(ngModel)]="saisie" [attr.aria-invalid]="!valide()" autocomplete="off"
              spellcheck="false" />
          </label>
          <button type="submit" class="btn-secondaire" [disabled]="!valide() || saisie === store.projetId()">
            Changer
          </button>
          <button type="button" class="btn-secondaire" (click)="nouveau()">Nouveau projet</button>
        </form>
      </div>

      <nav class="onglets" aria-label="Sections finance">
        @for (onglet of onglets; track onglet.route) {
          <a [routerLink]="onglet.route" routerLinkActive="actif" ariaCurrentWhenActive="page">{{ onglet.libelle }}</a>
        }
      </nav>
    </div>

    <router-outlet />
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
    .projet .champ {
      width: min(100%, 340px);
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

  protected readonly onglets = [
    { route: 'apercu', libelle: "Vue d'ensemble" },
    { route: 'previsions', libelle: 'Prévisions' },
    { route: 'projections', libelle: 'Projections' },
    { route: 'documents', libelle: 'Documents' },
    { route: 'assistant', libelle: 'Assistant IA' },
  ];

  protected saisie = this.store.projetId();

  ngOnInit(): void {
    this.store.recharger();
  }

  protected valide(): boolean {
    return UUID.test(this.saisie.trim());
  }

  protected appliquer(): void {
    if (this.valide()) {
      this.store.changerProjet(this.saisie.trim().toLowerCase());
    }
  }

  protected nouveau(): void {
    this.store.nouveauProjet();
    this.saisie = this.store.projetId();
  }
}
