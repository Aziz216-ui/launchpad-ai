import { Pipe, PipeTransform } from '@angular/core';

import { DEVISE } from '../models/libelles';

const FORMAT = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });
const FORMAT_ENTIER = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });

/** 125000.5 → « 125 000,5 TND » ; `entier` supprime les décimales (cartes et graphiques). */
@Pipe({ name: 'montant' })
export class MontantPipe implements PipeTransform {
  transform(valeur: number | null | undefined, entier = false): string {
    if (valeur === null || valeur === undefined) return '—';
    return `${(entier ? FORMAT_ENTIER : FORMAT).format(valeur)} ${DEVISE}`;
  }
}

/** 60 → « 60 % ». */
@Pipe({ name: 'taux' })
export class TauxPipe implements PipeTransform {
  transform(valeur: number | null | undefined): string {
    if (valeur === null || valeur === undefined) return '—';
    return `${FORMAT.format(valeur)} %`;
  }
}
