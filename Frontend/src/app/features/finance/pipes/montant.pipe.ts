import { Pipe, PipeTransform } from '@angular/core';

import { DEVISE } from '../models/libelles';

const FORMAT = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });
const FORMAT_ENTIER = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });

const FORMAT_CENTIMES = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * 125000.5 → « 125 000,5 TND ».
 * Variante `true` (ou 'entier') : sans décimales, pour les tableaux de bord (cartes, graphiques, tableaux).
 * Variante 'centimes' : toujours 2 décimales, comme les exports PDF / Excel, pour les documents financiers.
 */
@Pipe({ name: 'montant' })
export class MontantPipe implements PipeTransform {
  transform(valeur: number | null | undefined, format: boolean | 'entier' | 'centimes' = false): string {
    if (valeur === null || valeur === undefined) return '—';
    const formateur = format === true || format === 'entier' ? FORMAT_ENTIER
      : format === 'centimes' ? FORMAT_CENTIMES : FORMAT;
    return `${formateur.format(valeur)} ${DEVISE}`;
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
