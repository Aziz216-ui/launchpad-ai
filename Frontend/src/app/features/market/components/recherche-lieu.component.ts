import { ChangeDetectionStrategy, Component, DestroyRef, computed, forwardRef, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { Subject, catchError, debounceTime, distinctUntilChanged, filter, from, map, of, switchMap, tap } from 'rxjs';

import { CarteLieuxComponent } from './carte-lieux.component';
import { GeocodageService, Lieu } from '../services/geocodage.service';

/** Debounce et longueur minimale : au plus une requ├¬te Nominatim par seconde, et pas pour 1 ou 2 lettres. */
const DEBOUNCE_MS = 600;
const LONGUEUR_MIN = 3;

let compteur = 0;

/**
 * Champ ┬½ lieu ┬╗ avec suggestions OpenStreetMap (Nominatim) et petite carte.
 * Le lieu se choisit au clavier (suggestions) ou sur la carte (clic ou d├⌐placement du marqueur,
 * puis reverse geocoding). La valeur du formulaire reste un simple texte (ex. ┬½ Sfax, Tunisie ┬╗) :
 * la saisie libre est toujours accept├⌐e, y compris quand Nominatim ne r├⌐pond pas.
 */
@Component({
  selector: 'app-recherche-lieu',
  imports: [CarteLieuxComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => RechercheLieuComponent), multi: true }],
  templateUrl: './recherche-lieu.component.html',
  styleUrl: './recherche-lieu.component.scss',
})
export class RechercheLieuComponent implements ControlValueAccessor {
  private readonly geocodage = inject(GeocodageService);

  readonly identifiant = input(`recherche-lieu-${++compteur}`);
  readonly placeholder = input('Ex. Sfax, Tunisie');
  readonly invalide = input(false);

  protected readonly texte = signal('');
  protected readonly suggestions = signal<Lieu[]>([]);
  protected readonly ouvert = signal(false);
  protected readonly actif = signal(-1);
  protected readonly recherche = signal(false);
  protected readonly indisponible = signal(false);
  protected readonly desactive = signal(false);
  /** Lieu affich├⌐ sur la carte : suggestion choisie, point cliqu├⌐, ou texte saisi g├⌐ocod├⌐ ├á la sortie du champ. */
  protected readonly lieu = signal<Lieu | null>(null);
  /** Reverse geocoding d'un point choisi sur la carte. */
  protected readonly lieuCarte = signal<'aucun' | 'recherche' | 'introuvable'>('aucun');
  /** Num├⌐ro de la derni├¿re demande de placement : une r├⌐ponse plus ancienne est ignor├⌐e. */
  private placement = 0;

  protected readonly listeId = computed(() => `${this.identifiant()}-suggestions`);
  protected readonly points = computed(() => {
    const lieu = this.lieu();
    return lieu ? [{ titre: lieu.libelle, lignes: [], lat: lieu.lat, lon: lieu.lon }] : [];
  });

  private readonly saisies = new Subject<string>();
  private onChange: (valeur: string) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  constructor() {
    this.saisies
      .pipe(
        map((texte) => texte.trim()),
        tap((texte) => {
          if (texte.length < LONGUEUR_MIN) this.fermer();
        }),
        debounceTime(DEBOUNCE_MS),
        filter((texte) => texte.length >= LONGUEUR_MIN),
        distinctUntilChanged(),
        tap(() => this.recherche.set(true)),
        switchMap((texte) =>
          from(this.geocodage.rechercher(texte)).pipe(
            map((lieux) => ({ texte, lieux, erreur: false })),
            catchError(() => of({ texte, lieux: [] as Lieu[], erreur: true })),
          ),
        ),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe(({ texte, lieux, erreur }) => {
        this.recherche.set(false);
        this.indisponible.set(erreur);
        // R├⌐ponse arriv├⌐e apr├¿s que le texte a encore chang├⌐ : ignor├⌐e
        if (texte !== this.texte().trim()) return;
        this.suggestions.set(lieux);
        this.actif.set(-1);
        this.ouvert.set(lieux.length > 0);
      });
  }

  writeValue(valeur: string | null): void {
    const texte = valeur ?? '';
    this.texte.set(texte);
    this.fermer();
    this.lieu.set(null);
    this.localiser(texte);
  }

  registerOnChange(fn: (valeur: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(desactive: boolean): void {
    this.desactive.set(desactive);
  }

  protected saisir(evenement: Event): void {
    const texte = (evenement.target as HTMLInputElement).value;
    this.texte.set(texte);
    this.onChange(texte);
    this.lieuCarte.set('aucun');
    this.saisies.next(texte);
  }

  protected choisir(lieu: Lieu): void {
    this.placement++;
    this.texte.set(lieu.libelle);
    this.onChange(lieu.libelle);
    this.lieu.set(lieu);
    this.lieuCarte.set('aucun');
    this.fermer();
  }

  /** Clic sur la carte ou fin du d├⌐placement du marqueur : le champ prend le nom du lieu. */
  protected choisirSurCarte({ lat, lon }: { lat: number; lon: number }): void {
    const demande = ++this.placement;
    // Le marqueur suit tout de suite le clic ; le nom arrive avec la r├⌐ponse de Nominatim
    this.lieu.set({ libelle: this.texte(), detail: '', lat, lon });
    this.lieuCarte.set('recherche');
    this.fermer();
    this.onTouched();
    this.geocodage.lieuAuxCoordonnees(lat, lon).then(
      (lieu) => {
        if (demande !== this.placement) return;
        if (!lieu) {
          this.lieuCarte.set('introuvable');
          return;
        }
        this.texte.set(lieu.libelle);
        this.onChange(lieu.libelle);
        this.lieu.set(lieu);
        this.lieuCarte.set('aucun');
      },
      () => {
        if (demande === this.placement) this.lieuCarte.set('introuvable');
      },
    );
  }

  protected clavier(evenement: KeyboardEvent): void {
    const liste = this.suggestions();
    if (!this.ouvert() || !liste.length) return;
    if (evenement.key === 'ArrowDown' || evenement.key === 'ArrowUp') {
      evenement.preventDefault();
      const pas = evenement.key === 'ArrowDown' ? 1 : -1;
      this.actif.update((i) => (i + pas + liste.length) % liste.length);
    } else if (evenement.key === 'Enter' && this.actif() >= 0) {
      evenement.preventDefault();
      this.choisir(liste[this.actif()]);
    } else if (evenement.key === 'Escape') {
      this.fermer();
    }
  }

  protected sortie(): void {
    this.onTouched();
    this.fermer();
    if (this.lieu()?.libelle !== this.texte()) this.localiser(this.texte());
  }

  /** Place sur la carte un texte saisi librement (sans suggestion choisie), si Nominatim le trouve. */
  private localiser(texte: string): void {
    if (texte.trim().length < LONGUEUR_MIN) return;
    const demande = ++this.placement;
    this.geocodage.localiser(texte).then(
      (lieu) => {
        if (lieu && demande === this.placement && this.texte() === texte) this.lieu.set(lieu);
      },
      () => this.indisponible.set(true),
    );
  }

  private fermer(): void {
    this.ouvert.set(false);
    this.actif.set(-1);
  }
}
