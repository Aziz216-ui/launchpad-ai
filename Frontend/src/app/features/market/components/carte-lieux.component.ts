import {
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation,
  DestroyRef,
  ElementRef,
  afterNextRender,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import type { LayerGroup, Map as CarteLeaflet } from 'leaflet';

import { PointCarte } from '../services/geocodage.service';

type Leaflet = typeof import('leaflet');

const TUILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>';
/** Vue par défaut sans marqueur : la Tunisie. */
const CENTRE_DEFAUT: [number, number] = [34, 9.5];

let leaflet: Promise<Leaflet> | null = null;

/**
 * Charge Leaflet et sa feuille de style une seule fois, à la première carte affichée.
 * La feuille de style est un bundle séparé (angular.json, « inject: false ») : elle ne pèse
 * pas sur les autres modules.
 */
function chargerLeaflet(): Promise<Leaflet> {
  leaflet ??= Promise.all([
    // Build ESM du paquet (le point d'entrée « leaflet » est en UMD, moins bien optimisé)
    import('leaflet/dist/leaflet-src.esm.js') as Promise<Leaflet>,
    new Promise<void>((ok, echec) => {
      const lien = document.createElement('link');
      lien.rel = 'stylesheet';
      lien.href = 'leaflet.css';
      lien.onload = () => ok();
      lien.onerror = () => echec(new Error('Feuille de style Leaflet introuvable'));
      document.head.appendChild(lien);
    }),
  ])
    .then(([L]) => L)
    .catch((e: unknown) => {
      leaflet = null;
      throw e;
    });
  return leaflet;
}

/**
 * Carte OpenStreetMap (Leaflet) avec un marqueur par point et une infobulle.
 * En mode `selectionnable`, un clic sur la carte ou le déplacement du marqueur émet `choisi`
 * (le parent met alors à jour `points`).
 * Si Leaflet ou le fond de carte ne se chargent pas, un message remplace la carte
 * et le reste de la page fonctionne normalement.
 */
@Component({
  selector: 'app-carte-lieux',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'carte-lieux', '[class.selectionnable]': 'selectionnable()' },
  styleUrl: './carte-lieux.component.scss',
  template: `
    <div #conteneur class="carte-lieux-fond" [style.height.px]="hauteur()" role="region" [attr.aria-label]="libelle()"></div>
    @if (etat() === 'erreur') {
      <p class="carte-lieux-message">Carte indisponible pour le moment.</p>
    } @else if (etat() === 'pret' && !points().length && messageVide()) {
      <p class="carte-lieux-message discret">{{ messageVide() }}</p>
    }
  `,
})
export class CarteLieuxComponent {
  readonly points = input.required<PointCarte[]>();
  readonly hauteur = input(260);
  /** Zoom quand il n'y a qu'un seul marqueur. */
  readonly zoom = input(10);
  readonly libelle = input('Carte');
  readonly messageVide = input('');
  readonly selectionnable = input(false);
  readonly choisi = output<{ lat: number; lon: number }>();

  protected readonly etat = signal<'chargement' | 'pret' | 'erreur'>('chargement');

  private readonly conteneur = viewChild.required<ElementRef<HTMLElement>>('conteneur');
  private L: Leaflet | null = null;
  private carte: CarteLeaflet | null = null;
  private marqueurs: LayerGroup | null = null;
  /**
   * Dernier point placé à la main : tant que le marqueur y reste (y compris quand le parent
   * renvoie ce point avec son nom), la vue ne bouge pas sous le curseur.
   */
  private positionChoisie: string | null = null;

  constructor() {
    const destroyRef = inject(DestroyRef);
    let observateur: ResizeObserver | null = null;

    afterNextRender(() => {
      chargerLeaflet().then(
        (L) => {
          if (destroyRef.destroyed) return;
          this.L = L;
          const element = this.conteneur().nativeElement;
          this.carte = L.map(element, { scrollWheelZoom: false }).setView(CENTRE_DEFAUT, 5);
          L.tileLayer(TUILES, { maxZoom: 19, attribution: ATTRIBUTION }).addTo(this.carte);
          this.carte.attributionControl.setPrefix(false);
          this.marqueurs = L.layerGroup().addTo(this.carte);
          this.carte.on('click', (e) => {
            if (this.selectionnable()) this.choisir(e.latlng.lat, e.latlng.lng);
          });
          // Le conteneur peut changer de taille (mise en page, mobile) : la carte reste cadrée sur ses points
          observateur = new ResizeObserver(() => {
            this.carte?.invalidateSize({ pan: false });
            this.cadrer();
          });
          observateur.observe(element);
          // L'effet ci-dessous dessine les marqueurs dès que la carte est prête
          this.etat.set('pret');
        },
        () => this.etat.set('erreur'),
      );
    });

    effect(() => {
      const points = this.points();
      if (this.etat() === 'pret') this.dessiner(points);
    });

    destroyRef.onDestroy(() => {
      observateur?.disconnect();
      this.carte?.remove();
    });
  }

  private dessiner(points: PointCarte[]): void {
    const { L, carte, marqueurs } = this;
    if (!L || !carte || !marqueurs) return;
    marqueurs.clearLayers();
    // Marqueur dessiné en CSS : aucune image à copier, il s'affiche aussi en production
    const icone = L.divIcon({ className: 'carte-lieux-marqueur', html: '<span></span>', iconSize: [24, 24], iconAnchor: [12, 29], popupAnchor: [0, -26] });
    const selectionnable = this.selectionnable();
    for (const point of points) {
      const marqueur = L.marker([point.lat, point.lon], { icon: icone, title: point.titre, alt: point.titre, draggable: selectionnable });
      if (selectionnable) {
        marqueur.on('dragend', () => {
          const position = marqueur.getLatLng();
          this.choisir(position.lat, position.lng);
        });
      } else {
        marqueur.bindPopup(infobulle(point));
      }
      marqueur.addTo(marqueurs);
    }
    const placeALaMain = points.length === 1 && cle(points[0].lat, points[0].lon) === this.positionChoisie;
    if (!placeALaMain) {
      this.positionChoisie = null;
      this.cadrer();
    }
  }

  private choisir(lat: number, lon: number): void {
    this.positionChoisie = cle(lat, lon);
    this.choisi.emit({ lat, lon });
  }

  /** Centre la carte sur l'unique point, ou l'ajuste pour tous les montrer. */
  private cadrer(): void {
    const { L, carte } = this;
    const points = this.points();
    if (!L || !carte) return;
    if (points.length === 1) {
      carte.setView([points[0].lat, points[0].lon], this.zoom(), { animate: false });
    } else if (points.length > 1) {
      carte.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lon])), { padding: [32, 32], maxZoom: 6, animate: false });
    }
  }
}

const cle = (lat: number, lon: number) => `${lat.toFixed(6)},${lon.toFixed(6)}`;

/** Contenu de l'infobulle construit en DOM (textContent) : les noms saisis ne sont jamais interprétés en HTML. */
function infobulle(point: PointCarte): HTMLElement {
  const bloc = document.createElement('div');
  const titre = document.createElement('strong');
  titre.textContent = point.titre;
  bloc.appendChild(titre);
  if (point.lignes.length) {
    const liste = document.createElement('ul');
    for (const ligne of point.lignes) {
      const item = document.createElement('li');
      item.textContent = ligne;
      liste.appendChild(item);
    }
    bloc.appendChild(liste);
  }
  return bloc;
}
