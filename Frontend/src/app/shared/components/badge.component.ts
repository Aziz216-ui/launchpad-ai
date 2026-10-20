import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * Badge arrondi des maquettes.
 * Variantes de couleur : succes (vert), attention (orange), danger (rouge),
 * info (bleu-vert), neutre (gris).
 */
export type VarianteBadge = 'succes' | 'attention' | 'danger' | 'info' | 'neutre';

const COULEURS: Record<VarianteBadge, { fond: string; texte: string }> = {
  succes: { fond: '#E8F5EE', texte: '#1C5A3D' },
  attention: { fond: '#FDF0DC', texte: '#9A5B07' },
  danger: { fond: '#FBEDED', texte: '#8E2B2B' },
  info: { fond: '#E3F0F1', texte: '#1F6470' },
  neutre: { fond: '#F1F4F5', texte: '#3D5257' },
};

@Component({
  selector: 'app-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    span {
      display: inline-block;
      font-size: 12px;
      font-weight: 600;
      padding: 3px 10px;
      border-radius: 999px;
      white-space: nowrap;
    }
  `,
  template: `<span [style.background]="couleurs().fond" [style.color]="couleurs().texte"
    [style.font-size.px]="petit() ? 11 : 12" [style.padding]="petit() ? '2px 8px' : null"><ng-content /></span>`,
})
export class BadgeComponent {
  readonly variante = input<VarianteBadge>('neutre');
  readonly petit = input(false);
  protected readonly couleurs = computed(() => COULEURS[this.variante()]);
}
