import { Injectable } from '@angular/core';

/** Lieu trouv├⌐ par Nominatim : libell├⌐ court enregistr├⌐ (┬½ Sfax, Tunisie ┬╗) et coordonn├⌐es. */
export interface Lieu {
  libelle: string;
  detail: string;
  lat: number;
  lon: number;
}

/** Marqueur ├á placer sur une carte : un lieu et les noms qui s'y rattachent (infobulle). */
export interface PointCarte {
  titre: string;
  lignes: string[];
  lat: number;
  lon: number;
}

interface ResultatNominatim {
  lat: string;
  lon: string;
  name?: string;
  display_name: string;
  address?: AdresseNominatim;
}

interface AdresseNominatim {
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  state?: string;
  region?: string;
  county?: string;
  country?: string;
}

/** R├⌐ponse de /reverse : un lieu, ou { error } quand rien n'est trouv├⌐ (mer, d├⌐sertΓÇª). */
type ReponseInverse = (ResultatNominatim & { error?: undefined }) | { error: string };

const NOMINATIM = 'https://nominatim.openstreetmap.org';
/** Politique d'usage de Nominatim : au plus une requ├¬te par seconde. */
const INTERVALLE_MIN_MS = 1000;
const DELAI_MAX_MS = 8000;
/** Emprise de la Tunisie (lon/lat) : favorise ses lieux sans exclure le reste du monde (bounded=0). */
const EMPRISE_TUNISIE = '7.5,37.6,11.7,30.2';

const attendre = (ms: number) => new Promise<void>((ok) => setTimeout(ok, Math.max(0, ms)));

/**
 * G├⌐ocodage OpenStreetMap (Nominatim), sans cl├⌐ API.
 *
 * Appel├⌐ avec fetch et non HttpClient : l'intercepteur du module ajouterait le jeton
 * de l'utilisateur et afficherait un toast d'erreur, ce qui n'a pas lieu d'├¬tre pour un
 * service externe facultatif. Les requ├¬tes sont espac├⌐es d'au moins une seconde et leurs
 * r├⌐sultats gard├⌐s en m├⌐moire ; une erreur rejette la promesse (l'appelant reste en saisie libre).
 */
@Injectable({ providedIn: 'root' })
export class GeocodageService {
  private readonly cache = new Map<string, Promise<unknown>>();
  private file: Promise<void> = Promise.resolve();
  private derniereRequete = 0;

  /** Suggestions pour un texte saisi (5 au plus, en fran├ºais, Tunisie en priorit├⌐). */
  rechercher(texte: string): Promise<Lieu[]> {
    return this.chercher({ q: texte.trim(), limit: '5', viewbox: EMPRISE_TUNISIE, bounded: '0' });
  }

  /** Lieu le plus probable pour un texte libre (m├¬me requ├¬te que les suggestions : cache partag├⌐). */
  localiser(texte: string): Promise<Lieu | null> {
    return this.rechercher(texte).then((lieux) => lieux[0] ?? null);
  }

  /** Coordonn├⌐es d'un pays (recherche structur├⌐e par pays). */
  localiserPays(pays: string): Promise<Lieu | null> {
    return this.chercher({ country: pays.trim(), limit: '1' }).then((lieux) => lieux[0] ?? null);
  }

  /**
   * Lieu aux coordonn├⌐es d'un clic sur la carte (reverse geocoding, niveau ville) :
   * ┬½ Ville, Pays ┬╗, ou ┬½ R├⌐gion, Pays ┬╗ sans ville ; null si rien n'est trouv├⌐.
   * Les coordonn├⌐es sont arrondies ├á environ 100 m pour profiter du cache.
   */
  lieuAuxCoordonnees(lat: number, lon: number): Promise<Lieu | null> {
    const parametres = { lat: lat.toFixed(3), lon: lon.toFixed(3), zoom: '10' };
    return this.appeler<ReponseInverse>('reverse', parametres).then((r) => {
      if (r.error !== undefined) return null;
      const a = r.address ?? {};
      const region = sansPrefixeAdministratif(a.state || a.region || '');
      const nom = a.city || a.town || a.village || a.municipality || region || a.county;
      const libelle = nom && a.country ? `${nom}, ${a.country}` : nom || a.country;
      return libelle ? { libelle, detail: r.display_name, lat, lon } : null;
    });
  }

  /**
   * Un marqueur par lieu : `groupes` associe chaque lieu (pays ou localisation) aux noms
   * ├á afficher dans l'infobulle. Les lieux introuvables ou en erreur sont ignor├⌐s.
   */
  async placer(groupes: Map<string, string[]>, type: 'pays' | 'lieu'): Promise<PointCarte[]> {
    const resultats = await Promise.allSettled(
      [...groupes].map(async ([titre, lignes]) => {
        const lieu = type === 'pays' ? await this.localiserPays(titre) : await this.localiser(titre);
        return lieu ? { titre, lignes, lat: lieu.lat, lon: lieu.lon } : null;
      }),
    );
    return resultats.flatMap((r) => (r.status === 'fulfilled' && r.value ? [r.value] : []));
  }

  private chercher(parametres: Record<string, string>): Promise<Lieu[]> {
    return this.appeler<ResultatNominatim[]>('search', parametres).then((resultats) => resultats.map(versLieu));
  }

  private appeler<T>(service: 'search' | 'reverse', parametres: Record<string, string>): Promise<T> {
    const url = `${NOMINATIM}/${service}?${new URLSearchParams({
      format: 'json',
      addressdetails: '1',
      'accept-language': 'fr',
      ...parametres,
    })}`;
    const enCache = this.cache.get(url) as Promise<T> | undefined;
    if (enCache) return enCache;

    const promesse = this.planifier()
      .then(() => fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(DELAI_MAX_MS) }))
      .then((reponse) => {
        if (!reponse.ok) throw new Error(`Nominatim : ${reponse.status}`);
        return reponse.json() as Promise<T>;
      });
    // Une erreur n'est pas gard├⌐e : la m├¬me recherche pourra ├¬tre retent├⌐e plus tard
    promesse.catch(() => this.cache.delete(url));
    this.cache.set(url, promesse);
    return promesse;
  }

  /** R├⌐serve le prochain cr├⌐neau libre (une requ├¬te par seconde au plus). */
  private planifier(): Promise<void> {
    const creneau = this.file.then(async () => {
      await attendre(this.derniereRequete + INTERVALLE_MIN_MS - Date.now());
      this.derniereRequete = Date.now();
    });
    this.file = creneau;
    return creneau;
  }
}

/**
 * ┬½ Gouvernorat Sfax ┬╗ ΓåÆ ┬½ Sfax ┬╗, ┬½ R├⌐gion de Normandie ┬╗ ΓåÆ ┬½ Normandie ┬╗ : libell├⌐ court.
 * En Tunisie, une partie des villes n'a pas de contour ┬½ ville ┬╗ dans OpenStreetMap :
 * un clic en ville ne renvoie alors que le gouvernorat.
 */
function sansPrefixeAdministratif(nom: string): string {
  return nom.replace(/^(gouvernorat|d├⌐l├⌐gation|wilaya|province|r├⌐gion|pr├⌐fecture)\s+(de\s+la\s+|de\s+l['ΓÇÖ]|de\s+|d['ΓÇÖ]|du\s+|des\s+)?/i, '').trim();
}

function versLieu(r: ResultatNominatim): Lieu {
  const nom = r.name || r.display_name.split(',')[0].trim();
  const pays = r.address?.country;
  return {
    libelle: pays && pays !== nom ? `${nom}, ${pays}` : nom,
    detail: r.display_name,
    lat: Number(r.lat),
    lon: Number(r.lon),
  };
}

/** Regroupe des ├⌐l├⌐ments par lieu (texte non vide, sans tenir compte de la casse) : lieu ΓåÆ noms. */
export function regrouperParLieu<T>(elements: T[], lieu: (e: T) => string, nom: (e: T) => string): Map<string, string[]> {
  const groupes = new Map<string, { titre: string; noms: string[] }>();
  for (const element of elements) {
    const titre = lieu(element)?.trim();
    if (!titre) continue;
    const cle = titre.toLocaleLowerCase('fr');
    const groupe = groupes.get(cle) ?? { titre, noms: [] };
    groupe.noms.push(nom(element));
    groupes.set(cle, groupe);
  }
  return new Map([...groupes.values()].map((g) => [g.titre, g.noms]));
}
