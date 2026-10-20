import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type NomIcone =
  | 'logo'
  | 'selecteur'
  | 'tableau-de-bord'
  | 'etoile'
  | 'graphique'
  | 'carte'
  | 'balance'
  | 'calculatrice'
  | 'mallette'
  | 'recherche'
  | 'cloche'
  | 'telecharger'
  | 'valider'
  | 'plus'
  | 'options'
  | 'fermer'
  | 'corbeille'
  | 'hausse'
  | 'baisse'
  | 'fleche'
  | 'info'
  | 'document'
  | 'cercle-valide'
  | 'crayon';

/** Icônes SVG reprises à l'identique des maquettes (tracés et épaisseurs). */
@Component({
  selector: 'app-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: inline-flex; flex-shrink: 0;', 'aria-hidden': 'true' },
  template: `
    @switch (nom()) {
      @case ('logo') {
        <svg [attr.width]="taille()" [attr.height]="taille()" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 19l4-4M14 4c3 0 6 3 6 6l-7 7-6-6z"></path><path d="M9 11l-3 1-2 3 4 1"></path></svg>
      }
      @case ('selecteur') {
        <svg [attr.width]="taille()" [attr.height]="taille()" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 10l4-4 4 4M8 14l4 4 4-4"></path></svg>
      }
      @case ('tableau-de-bord') {
        <svg [attr.width]="taille()" [attr.height]="taille()" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"></rect><rect x="14" y="3" width="7" height="7" rx="1.5"></rect><rect x="3" y="14" width="7" height="7" rx="1.5"></rect><rect x="14" y="14" width="7" height="7" rx="1.5"></rect></svg>
      }
      @case ('etoile') {
        <svg [attr.width]="taille()" [attr.height]="taille()" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"></path></svg>
      }
      @case ('graphique') {
        <svg [attr.width]="taille()" [attr.height]="taille()" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20V11M10 20V5M16 20v-6M21 20H3"></path></svg>
      }
      @case ('carte') {
        <svg [attr.width]="taille()" [attr.height]="taille()" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="18" height="13" rx="2"></rect><path d="M16 12h2M3 10h18"></path></svg>
      }
      @case ('balance') {
        <svg [attr.width]="taille()" [attr.height]="taille()" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v16M6 8h12M6 8l-3 6h6zM18 8l-3 6h6zM8 20h8"></path></svg>
      }
      @case ('calculatrice') {
        <svg [attr.width]="taille()" [attr.height]="taille()" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="3" width="14" height="18" rx="2"></rect><path d="M8 7h8M8 12h2M14 12h2M8 16h2M14 16h2"></path></svg>
      }
      @case ('mallette') {
        <svg [attr.width]="taille()" [attr.height]="taille()" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="7" width="18" height="13" rx="2"></rect><path d="M9 7V5h6v2M3 13h18"></path></svg>
      }
      @case ('recherche') {
        <svg [attr.width]="taille()" [attr.height]="taille()" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"></circle><path d="M20 20l-4-4"></path></svg>
      }
      @case ('cloche') {
        <svg [attr.width]="taille()" [attr.height]="taille()" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 16V11a6 6 0 0112 0v5l2 2H4zM10 21h4"></path></svg>
      }
      @case ('telecharger') {
        <svg [attr.width]="taille()" [attr.height]="taille()" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"></path></svg>
      }
      @case ('valider') {
        <svg [attr.width]="taille()" [attr.height]="taille()" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5 9-10"></path></svg>
      }
      @case ('plus') {
        <svg [attr.width]="taille()" [attr.height]="taille()" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"></path></svg>
      }
      @case ('options') {
        <svg [attr.width]="taille()" [attr.height]="taille()" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.6"></circle><circle cx="12" cy="12" r="1.6"></circle><circle cx="12" cy="19" r="1.6"></circle></svg>
      }
      @case ('fermer') {
        <svg [attr.width]="taille()" [attr.height]="taille()" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"></path></svg>
      }
      @case ('corbeille') {
        <svg [attr.width]="taille()" [attr.height]="taille()" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"></path></svg>
      }
      @case ('hausse') {
        <svg [attr.width]="taille()" [attr.height]="taille()" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 16l6-6 4 4 6-6M14 8h6v6"></path></svg>
      }
      @case ('baisse') {
        <svg [attr.width]="taille()" [attr.height]="taille()" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8l6 6 4-4 6 6M14 16h6v-6"></path></svg>
      }
      @case ('fleche') {
        <svg [attr.width]="taille()" [attr.height]="taille()" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h16M14 6l6 6-6 6"></path></svg>
      }
      @case ('info') {
        <svg [attr.width]="taille()" [attr.height]="taille()" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"></circle><path d="M12 11v5M12 8h.01"></path></svg>
      }
      @case ('document') {
        <svg [attr.width]="taille()" [attr.height]="taille()" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 3h7l5 5v13H7zM14 3v5h5"></path></svg>
      }
      @case ('cercle-valide') {
        <svg [attr.width]="taille()" [attr.height]="taille()" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"></circle><path d="M8 12l3 3 5-6"></path></svg>
      }
      @case ('crayon') {
        <svg [attr.width]="taille()" [attr.height]="taille()" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16zM13 7l4 4"></path></svg>
      }
    }
  `,
})
export class IconComponent {
  readonly nom = input.required<NomIcone>();
  readonly taille = input(18);
}
