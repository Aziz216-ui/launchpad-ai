import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { Projection } from '../models/finance.models';
import { MontantPipe } from '../pipes/montant.pipe';

const LARGEUR = 640;
const HAUTEUR = 260;
const MARGE = { haut: 24, droite: 12, bas: 36, gauche: 56 };

/** Histogramme groupé (CA, dépenses, marge) par année de projection, dans les couleurs de la charte. */
@Component({
  selector: 'app-graphique-projections',
  imports: [MontantPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg [attr.viewBox]="'0 0 ' + largeur + ' ' + hauteur" role="img" [attr.aria-label]="description()">
      @for (g of graduations(); track g.y) {
        <line [attr.x1]="marge.gauche" [attr.x2]="largeur - marge.droite" [attr.y1]="g.y" [attr.y2]="g.y"
          stroke="#EEF2F3"></line>
        <text [attr.x]="marge.gauche - 8" [attr.y]="g.y + 4" text-anchor="end" class="axe">{{ g.libelle }}</text>
      }
      <line [attr.x1]="marge.gauche" [attr.x2]="largeur - marge.droite" [attr.y1]="zeroY()" [attr.y2]="zeroY()"
        stroke="#CFD8DB"></line>
      @for (groupe of groupes(); track groupe.annee) {
        @for (barre of groupe.barres; track barre.cle) {
          <rect [attr.x]="barre.x" [attr.y]="barre.y" [attr.width]="barre.largeur" [attr.height]="barre.hauteur"
            [attr.fill]="barre.couleur" rx="3">
            <title>{{ barre.cle }} · année {{ groupe.annee }} : {{ barre.valeur | montant }}</title>
          </rect>
        }
        <text [attr.x]="groupe.centre" [attr.y]="hauteur - 12" text-anchor="middle" class="axe">An {{ groupe.annee }}</text>
      }
    </svg>
    <ul class="legende">
      @for (serie of series; track serie.cle) {
        <li><span class="pastille" [style.background]="serie.couleur"></span>{{ serie.cle }}</li>
      }
    </ul>
  `,
  styles: `
    :host {
      display: block;
    }
    svg {
      width: 100%;
      height: auto;
      max-height: 320px;
    }
    .axe {
      font-size: 11px;
      fill: #5a6a6f;
      font-family: Poppins, sans-serif;
    }
    .legende {
      display: flex;
      gap: 16px;
      margin: 8px 0 0;
      padding: 0;
      list-style: none;
      font-size: 12px;
      color: #3d5257;
    }
    .pastille {
      display: inline-block;
      width: 10px;
      height: 10px;
      border-radius: 3px;
      margin-right: 6px;
    }
  `,
})
export class GraphiqueProjectionsComponent {
  readonly projections = input.required<Projection[]>();

  protected readonly largeur = LARGEUR;
  protected readonly hauteur = HAUTEUR;
  protected readonly marge = MARGE;
  protected readonly series = [
    { cle: "Chiffre d'affaires", couleur: '#2B7A86' },
    { cle: 'Dépenses', couleur: '#A9C9CE' },
    { cle: 'Marge', couleur: '#C47A0A' },
  ];

  /** Échelle verticale : inclut 0 et les marges négatives. */
  private readonly echelle = computed(() => {
    const valeurs = this.projections().flatMap((p) => [p.chiffreAffaires, p.depenses, p.marge]);
    const max = Math.max(0, ...valeurs);
    const min = Math.min(0, ...valeurs);
    const pas = pasLisible((max - min || 1) / 4);
    return { max: Math.ceil(max / pas) * pas, min: Math.floor(min / pas) * pas, pas };
  });

  private y(valeur: number): number {
    const { max, min } = this.echelle();
    const zone = HAUTEUR - MARGE.haut - MARGE.bas;
    return MARGE.haut + ((max - valeur) / (max - min || 1)) * zone;
  }

  protected readonly zeroY = computed(() => this.y(0));

  protected readonly graduations = computed(() => {
    const { max, min, pas } = this.echelle();
    const liste: { y: number; libelle: string }[] = [];
    for (let v = min; v <= max + pas / 2; v += pas) {
      liste.push({ y: this.y(v), libelle: abrege(v) });
    }
    return liste;
  });

  protected readonly groupes = computed(() => {
    const projections = this.projections();
    const zone = LARGEUR - MARGE.gauche - MARGE.droite;
    const largeurGroupe = zone / Math.max(projections.length, 1);
    const largeurBarre = Math.min(28, (largeurGroupe * 0.7) / 3);
    return projections.map((p, i) => {
      const centre = MARGE.gauche + largeurGroupe * i + largeurGroupe / 2;
      const valeurs = [p.chiffreAffaires, p.depenses, p.marge];
      return {
        annee: p.annee,
        centre,
        barres: this.series.map((serie, k) => {
          const valeur = valeurs[k];
          const haut = Math.min(this.y(valeur), this.y(0));
          return {
            cle: serie.cle,
            couleur: serie.couleur,
            valeur,
            x: centre + (k - 1) * (largeurBarre + 3) - largeurBarre / 2,
            y: haut,
            largeur: largeurBarre,
            hauteur: Math.max(Math.abs(this.y(valeur) - this.y(0)), 1),
          };
        }),
      };
    });
  });

  protected readonly description = computed(
    () => `Projections sur ${this.projections().length} an(s) : chiffre d'affaires, dépenses et marge par année`,
  );
}

/** Pas « lisible » (1, 2, 5 × 10^n) pour les graduations. */
function pasLisible(brut: number): number {
  const puissance = Math.pow(10, Math.floor(Math.log10(brut)));
  const fraction = brut / puissance;
  const arrondi = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;
  return arrondi * puissance;
}

function abrege(valeur: number): string {
  const absolu = Math.abs(valeur);
  if (absolu >= 1_000_000) return `${(valeur / 1_000_000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} M`;
  if (absolu >= 1_000) return `${(valeur / 1_000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} k`;
  return valeur.toLocaleString('fr-FR');
}
