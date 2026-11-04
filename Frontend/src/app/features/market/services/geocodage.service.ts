import { Injectable } from '@angular/core';

/** Lieu trouvé par Nominatim : libellé court enregistré (« Sfax, Tunisie ») et coordonnées. */
export interface Lieu {
  libelle: string;
  detail: string;
  lat: number;
  lon: number;
}

/** Marqueur à placer sur une carte : un lieu et les noms qui s'y rattachent (infobulle). */
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
  address?: { country?: string };
}

const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
/** Politique d'usage de Nominatim : au plus une requête par seconde. */
const INTERVALLE_MIN_MS = 1000;
const DELAI_MAX_MS = 8000;
/** Emprise de la Tunisie (lon/lat) : favorise ses lieux sans exclure le reste du monde (bounded=0). */
const EMPRISE_TUNISIE = '7.5,37.6,11.7,30.2';

const attendre = (ms: number) => new Promise<void>((ok) => setTimeout(ok, Math.max(0, ms)));

/**
 * Géocodage OpenStreetMap (Nominatim), sans clé API.
 *
 * Appelé avec fetch et non HttpClient : l'intercepteur du module ajouterait le jeton
 * de l'utilisateur et afficherait un toast d'erreur, ce qui n'a pas lieu d'être pour un
 * service externe facultatif. Les requêtes sont espacées d'au moins une seconde et leurs
 * résultats gardés en mémoire ; une erreur rejette la promesse (l'appelant reste en saisie libre).
 */
@Injectable({ providedIn: 'root' })
export class GeocodageService {
  private readonly cache = new Map<string, Promise<Lieu[]>>();
  private file: Promise<void> = Promise.resolve();
  private derniereRequete = 0;

  /** Suggestions pour un texte saisi (5 au plus, en français, Tunisie en priorité). */
  rechercher(texte: string): Promise<Lieu[]> {
    return this.appeler({ q: texte.trim(), limit: '5', viewbox: EMPRISE_TUNISIE, bounded: '0' });
  }

  /** Lieu le plus probable pour un texte libre (même requête que les suggestions : cache partagé). */
  localiser(texte: string): Promise<Lieu | null> {
    return this.rechercher(texte).then((lieux) => lieux[0] ?? null);
  }

  /** Coordonnées d'un pays (recherche structurée par pays). */
  localiserPays(pays: string): Promise<Lieu | null> {
    return this.appeler({ country: pays.trim(), limit: '1' }).then((lieux) => lieux[0] ?? null);
  }

  /**
   * Un marqueur par lieu : `groupes` associe chaque lieu (pays ou localisation) aux noms
   * à afficher dans l'infobulle. Les lieux introuvables ou en erreur sont ignorés.
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

  private appeler(parametres: Record<string, string>): Promise<Lieu[]> {
    const url = `${NOMINATIM}?${new URLSearchParams({
      format: 'json',
      addressdetails: '1',
      'accept-language': 'fr',
      ...parametres,
    })}`;
    const enCache = this.cache.get(url);
    if (enCache) return enCache;

    const promesse = this.planifier()
      .then(() => fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(DELAI_MAX_MS) }))
      .then((reponse) => {
        if (!reponse.ok) throw new Error(`Nominatim : ${reponse.status}`);
        return reponse.json() as Promise<ResultatNominatim[]>;
      })
      .then((resultats) => resultats.map(versLieu));
    // Une erreur n'est pas gardée : la même recherche pourra être retentée plus tard
    promesse.catch(() => this.cache.delete(url));
    this.cache.set(url, promesse);
    return promesse;
  }

  /** Réserve le prochain créneau libre (une requête par seconde au plus). */
  private planifier(): Promise<void> {
    const creneau = this.file.then(async () => {
      await attendre(this.derniereRequete + INTERVALLE_MIN_MS - Date.now());
      this.derniereRequete = Date.now();
    });
    this.file = creneau;
    return creneau;
  }
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

/** Regroupe des éléments par lieu (texte non vide, sans tenir compte de la casse) : lieu → noms. */
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
