import { DEVISE } from '../market.config';

const nombreFr = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });
const nombreFr1 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });

/** Signe moins typographique, comme dans les maquettes (−14,7 %). */
const MOINS = '−';

/** 29 -> "29 €", 18.75 -> "18,75 €" ; compact : 24000000 -> "24 M€". */
export function formatMontant(valeur: number | null | undefined, compact = false): string {
  if (valeur === null || valeur === undefined) return '—';
  const devise = DEVISE;
  if (compact && Math.abs(valeur) >= 1_000_000) {
    return `${nombreFr1.format(valeur / 1_000_000)} M${devise}`;
  }
  if (compact && Math.abs(valeur) >= 10_000) {
    return `${nombreFr1.format(valeur / 1_000)} k${devise}`;
  }
  return `${nombreFr.format(valeur).replace('-', MOINS)} ${devise}`;
}

/** 8.4 -> "8,4 %" ; avec signe : "+8,4 %" / "−14,7 %". */
export function formatPourcentage(valeur: number | null | undefined, avecSigne = false): string {
  if (valeur === null || valeur === undefined) return '—';
  const texte = nombreFr1.format(Math.abs(valeur));
  const signe = valeur < 0 ? MOINS : avecSigne && valeur > 0 ? '+' : '';
  return `${signe}${texte} %`;
}

/** Nombre formaté pour un champ de saisie : 24000000 -> "24 000 000", 8.4 -> "8,4". */
export function formatSaisie(valeur: number | null | undefined): string {
  if (valeur === null || valeur === undefined) return '';
  // \s couvre aussi les espaces insécables produites par Intl (catégorie Unicode Zs)
  return nombreFr.format(valeur).replace(/\s/g, ' ');
}

/** Lit un nombre saisi à la française ("24 000 000", "8,4"). null si vide, NaN si invalide. */
export function lireNombre(saisie: unknown): number | null {
  if (saisie === null || saisie === undefined) return null;
  const texte = String(saisie).replace(/\s/g, '').replace(',', '.');
  if (texte === '') return null;
  return /^-?\d+(\.\d+)?$/.test(texte) ? Number(texte) : Number.NaN;
}

/**
 * Initiales affichées dans les pastilles.
 * - persona : "Claire, la libérale débordée" -> "CL"
 * - concurrent : majuscules du nom, comme dans les maquettes ("NutriDesk" -> "ND", "Cabinet+" -> "C+")
 */
export function initiales(nom: string, mode: 'persona' | 'concurrent' = 'persona'): string {
  if (mode === 'concurrent') {
    const marquants = [...nom].filter((c) => c === '+' || (c !== c.toLowerCase() && /\p{L}/u.test(c)));
    if (marquants.length >= 2) return marquants.slice(0, 2).join('');
  }
  const mots = nom.replace(/[^\p{L}\p{N}\s]/gu, ' ').trim().split(/\s+/).filter(Boolean);
  if (!mots.length) return '?';
  if (mots.length === 1 || mots[0].length > 2) {
    return mots[0].slice(0, 2).toUpperCase();
  }
  return (mots[0][0] + mots[1][0]).toUpperCase();
}

/** Découpe un texte libre en lignes non vides (une idée par ligne). */
export function lignes(texte: string | null | undefined): string[] {
  return (texte ?? '')
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*(\d+[.)]|[-•*])\s*/, '').trim())
    .filter(Boolean);
}
