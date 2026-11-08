import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * État vide (maquette Liste-vide.dc.html) : illustration, titre, texte et actions projetées.
 * `compact` réduit les marges pour un usage à l'intérieur d'un onglet.
 */
@Component({
  selector: 'app-empty-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section [class.compact]="compact()">
      @if (!compact()) {
        <svg width="160" height="120" viewBox="0 0 160 120" fill="none" aria-hidden="true">
          <rect x="20" y="18" width="120" height="84" rx="12" fill="#E3F0F1"></rect>
          <rect x="36" y="64" width="14" height="24" rx="3" fill="#A9C9CE"></rect>
          <rect x="58" y="48" width="14" height="40" rx="3" fill="#7FB0B8"></rect>
          <rect x="80" y="56" width="14" height="32" rx="3" fill="#A9C9CE"></rect>
          <rect x="102" y="38" width="14" height="50" rx="3" fill="#2B7A86"></rect>
          <circle cx="118" cy="30" r="14" fill="#FFFFFF" stroke="#2B7A86" stroke-width="3"></circle>
          <path d="M128 40l10 10" stroke="#2B7A86" stroke-width="4" stroke-linecap="round"></path>
        </svg>
      }
      <h2>{{ titre() }}</h2>
      @if (texte()) {
        <p>{{ texte() }}</p>
      }
      <ng-content />
    </section>
  `,
  styles: `
    section {
      background: #ffffff;
      border: 1px solid #e3e8ea;
      border-radius: 16px;
      padding: 56px 24px;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      gap: 16px;
    }
    section.compact {
      border-radius: 14px;
      padding: 32px 24px;
      gap: 10px;
    }
    h2 {
      margin: 0;
      font-size: 20px;
      font-weight: 600;
    }
    .compact h2 {
      font-size: 16px;
    }
    p {
      margin: 0;
      max-width: 460px;
      font-size: 13px;
      line-height: 1.6;
      color: #5a6a6f;
    }
  `,
})
export class EmptyStateComponent {
  readonly titre = input.required<string>();
  readonly texte = input('');
  readonly compact = input(false);
}
