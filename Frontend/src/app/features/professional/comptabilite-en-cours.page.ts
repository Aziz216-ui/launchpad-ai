import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { EmptyStateComponent } from '../../shared/components/empty-state.component';

/**
 * Page provisoire de l'écran « Comptabilité » du module Professional.
 * À remplacer par les vraies pages du module (voir README.md de ce dossier).
 */
@Component({
  selector: 'app-comptabilite-en-cours',
  imports: [RouterLink, EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <nav class="fil-ariane" aria-label="Fil d'Ariane">
        <a routerLink="/">Mon espace</a><span aria-hidden="true">›</span><span class="courant">Comptabilité</span>
      </nav>
      <h1>Comptabilité</h1>
      <app-empty-state
        titre="Module en cours de développement"
        texte="Ce module est développé par un autre membre de l'équipe LaunchPad AI. Il sera disponible prochainement." />
    </div>
  `,
  styles: `
    .page {
      padding: 24px 32px 48px;
      display: flex;
      flex-direction: column;
      gap: 20px;
      max-width: 1240px;
    }
    .fil-ariane {
      display: flex;
      gap: 8px;
      font-size: 12px;
      color: #5a6a6f;
    }
    .fil-ariane a {
      color: #5a6a6f;
      text-decoration: none;
    }
    .courant {
      color: #1d2b2f;
    }
    h1 {
      margin: 0;
      font-size: 26px;
      font-weight: 600;
    }
    @media (max-width: 800px) {
      .page {
        padding: 20px 16px 40px;
      }
    }
  `,
})
export class ComptabiliteEnCoursPage {}
