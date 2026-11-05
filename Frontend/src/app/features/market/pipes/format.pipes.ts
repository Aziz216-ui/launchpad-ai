import { Pipe, PipeTransform } from '@angular/core';

import { formatMontant, formatPourcentage, initiales, lignes } from '../utils/format';

/** {{ 29 | montant }} -> "29 Γé¼" ; {{ 24000000 | montant: true }} -> "24 MΓé¼" */
@Pipe({ name: 'montant' })
export class MontantPipe implements PipeTransform {
  transform(valeur: number | null | undefined, compact = false): string {
    return formatMontant(valeur, compact);
  }
}

/** {{ 8.4 | pourcentage: true }} -> "+8,4 %" */
@Pipe({ name: 'pourcentage' })
export class PourcentagePipe implements PipeTransform {
  transform(valeur: number | null | undefined, avecSigne = false): string {
    return formatPourcentage(valeur, avecSigne);
  }
}

@Pipe({ name: 'initiales' })
export class InitialesPipe implements PipeTransform {
  transform(nom: string, mode: 'persona' | 'concurrent' = 'persona'): string {
    return initiales(nom, mode);
  }
}

/** Nom du secteur ; null (secteur supprim├⌐ dans SECTEUR-SERVICE) -> ┬½ Secteur supprim├⌐ ┬╗. */
@Pipe({ name: 'nomSecteur' })
export class NomSecteurPipe implements PipeTransform {
  transform(nom: string | null | undefined): string {
    return nom || 'Secteur supprim├⌐';
  }
}

/** Texte libre -> liste de lignes, pour les @for. */
@Pipe({ name: 'lignes' })
export class LignesPipe implements PipeTransform {
  transform(texte: string | null | undefined): string[] {
    return lignes(texte);
  }
}
