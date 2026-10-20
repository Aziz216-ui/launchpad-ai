import { DatePipe, Location } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Observable } from 'rxjs';

import { environment } from '../../../../../environments/environment';
import { NotificationService } from '../../../../core/notifications/notification.service';
import { BadgeComponent } from '../../../../shared/components/badge.component';
import { FieldErrorComponent } from '../../components/field-error.component';
import { LoaderComponent } from '../../../../shared/components/loader.component';
import { formatMontant, formatPourcentage, formatSaisie, lireNombre } from '../../utils/format';
import { appliquerErreursServeur, messageErreur, nombreValidator } from '../../utils/form';
import { POSITIONNEMENTS, STATUTS } from '../../models/libelles';
import { ComparaisonPrix, EtudeMarche, EtudeSaisie, Secteur, StatutEtude } from '../../models/market.models';
import { MarketApiService } from '../../services/market-api.service';

type Champ =
  | 'titre'
  | 'secteur'
  | 'cible'
  | 'zone_geographique'
  | 'taille_marche'
  | 'taux_croissance'
  | 'description_offre'
  | 'prix_propose'
  | 'hypotheses';

const CHAMPS_PAR_ETAPE: Record<number, Champ[]> = {
  1: ['titre', 'secteur', 'cible', 'zone_geographique', 'taille_marche', 'taux_croissance'],
  2: ['description_offre', 'prix_propose'],
  3: ['hypotheses'],
};

const ETAPES = ['Marché cible', 'Mon offre', 'Hypothèses'];

/** Textes du « conseil LaunchPad » repris de la maquette, un par étape. */
const CONSEILS = [
  'Définissez un marché précis. Une cible bien définie rend vos estimations et votre analyse de la concurrence plus utiles.',
  'Comparez des offres équivalentes : mêmes services, même fréquence de paiement et mêmes options incluses.',
  'Une bonne hypothèse est mesurable. Précisez ce que vous voulez vérifier et comment vous le testerez.',
];

const ZONES = ['France', 'Tunisie', 'Maghreb', 'Europe', 'International'];

/** Création et modification d'une étude en 3 étapes (maquette Creation.dc.html). */
@Component({
  selector: 'app-etude-formulaire',
  imports: [ReactiveFormsModule, RouterLink, DatePipe, BadgeComponent, FieldErrorComponent, LoaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './etude-formulaire.page.html',
  styleUrl: './etude-formulaire.page.scss',
})
export class EtudeFormulairePage implements OnInit {
  private readonly api = inject(MarketApiService);
  private readonly notifications = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly location = inject(Location);

  /** Paramètre de route (:id) en modification. */
  readonly id = input<string>();
  /** ?etape=2 : ouvre directement une étape (liens « Modifier mon prix », « Revoir mes hypothèses »). */
  readonly etape = input<string>();

  protected readonly etapes = ETAPES;
  protected readonly etapeCourante = signal(1);
  protected readonly conseil = computed(() => CONSEILS[this.etapeCourante() - 1]);

  protected readonly etudeId = signal<number | null>(null);
  protected readonly statut = signal<StatutEtude>('brouillon');
  protected readonly titreInitial = signal('');
  protected readonly secteurs = signal<Secteur[]>([]);
  protected readonly comparaison = signal<ComparaisonPrix | null>(null);
  protected readonly derniereSauvegarde = signal<string | null>(null);
  protected readonly chargement = signal(false);
  protected readonly enregistrement = signal(false);
  protected readonly erreurChargement = signal<string | null>(null);
  protected readonly statuts = STATUTS;

  protected readonly formulaire = inject(FormBuilder).nonNullable.group({
    titre: ['', [Validators.required, Validators.maxLength(200)]],
    secteur: [null as number | null, Validators.required],
    cible: ['', Validators.required],
    zone_geographique: ['', [Validators.required, Validators.maxLength(150)]],
    taille_marche: ['', [Validators.required, nombreValidator({ min: 0 })]],
    taux_croissance: ['', [Validators.required, nombreValidator()]],
    description_offre: ['', Validators.required],
    prix_propose: ['', [Validators.required, nombreValidator({ min: 0 })]],
    hypotheses: ['', Validators.required],
  });

  private readonly valeurs = toSignal(this.formulaire.valueChanges, {
    initialValue: this.formulaire.getRawValue(),
  });

  /** Zones proposées, plus la valeur enregistrée si elle n'est pas dans la liste. */
  protected readonly zones = computed(() => {
    const zone = this.valeurs().zone_geographique;
    return zone && !ZONES.includes(zone) ? [...ZONES, zone] : ZONES;
  });

  /** Encadré « Votre étude en bref », mis à jour pendant la saisie. */
  protected readonly resume = computed(() => {
    const v = this.valeurs();
    const nombre = (texte: string | undefined) => {
      const n = lireNombre(texte);
      return n === null || Number.isNaN(n) ? null : n;
    };
    const taille = nombre(v.taille_marche);
    const croissance = nombre(v.taux_croissance);
    const prix = nombre(v.prix_propose);
    return {
      titre: v.titre || '—',
      secteur: this.secteurs().find((s) => s.id === Number(v.secteur))?.nom ?? '—',
      zone: v.zone_geographique || '—',
      taille: taille === null ? '—' : `${formatMontant(taille, true)} / an`,
      croissance: croissance === null ? '—' : `${formatPourcentage(croissance, true)} / an`,
      prix: prix === null ? '—' : formatMontant(prix),
    };
  });

  /** Encadré de l'étape 2 : prix proposé comparé aux concurrents de l'étude. */
  protected readonly encadrePrix = computed(() => {
    const c = this.comparaison();
    if (!c || c.positionnement === 'inconnu' || c.prix_moyen === null || c.prix_propose === null) return null;
    const titres = {
      economique: 'Un prix accessible, à tester sur le terrain.',
      aligne: 'Un prix aligné sur le marché.',
      premium: 'Un prix premium, à justifier auprès de vos clients.',
    };
    const ecart = c.ecart_moyenne_pct;
    const sens = ecart === null ? '' : ecart < 0 ? ' en dessous du marché' : ' au-dessus du marché';
    return {
      titre: titres[c.positionnement],
      texte:
        `${formatMontant(c.prix_propose)} contre ${formatMontant(c.prix_moyen)} en moyenne chez les concurrents` +
        (ecart === null ? '.' : `, soit ${formatPourcentage(Math.abs(ecart))}${sens}.`),
    };
  });

  protected readonly positionnements = POSITIONNEMENTS;

  ngOnInit(): void {
    const etape = Number(this.etape());
    if (etape >= 1 && etape <= 3) this.etapeCourante.set(etape);

    this.api.listerSecteurs().subscribe({
      next: (secteurs) => this.secteurs.set(secteurs),
      error: (e: unknown) => this.notifications.erreur(messageErreur(e, 'Impossible de charger les secteurs.')),
    });

    const id = Number(this.id());
    if (id) this.chargerEtude(id);
  }

  private chargerEtude(id: number): void {
    this.chargement.set(true);
    this.api.lireEtude(id).subscribe({
      next: (etude) => {
        this.remplir(etude);
        this.chargement.set(false);
        this.chargerComparaison();
      },
      error: (e: unknown) => {
        this.erreurChargement.set(messageErreur(e, "Impossible de charger l'étude."));
        this.chargement.set(false);
      },
    });
  }

  private remplir(etude: EtudeMarche): void {
    this.etudeId.set(etude.id);
    this.statut.set(etude.statut);
    this.titreInitial.set(etude.titre);
    this.derniereSauvegarde.set(etude.date_mise_a_jour);
    this.formulaire.reset({
      titre: etude.titre,
      secteur: etude.secteur,
      cible: etude.cible,
      zone_geographique: etude.zone_geographique,
      taille_marche: formatSaisie(etude.taille_marche),
      taux_croissance: formatSaisie(etude.taux_croissance),
      description_offre: etude.description_offre,
      prix_propose: formatSaisie(etude.prix_propose),
      hypotheses: etude.hypotheses,
    });
  }

  private chargerComparaison(): void {
    const id = this.etudeId();
    if (id === null) return;
    this.api.comparaisonPrix(id).subscribe({
      next: (c) => this.comparaison.set(c),
      error: () => this.comparaison.set(null),
    });
  }

  protected allerA(etape: number): void {
    this.etapeCourante.set(etape);
  }

  protected precedent(): void {
    this.etapeCourante.update((e) => Math.max(1, e - 1));
  }

  /** Enregistre le brouillon : seuls le titre et le secteur sont indispensables. */
  protected enregistrerBrouillon(): void {
    if (!this.valider(['titre', 'secteur'], true)) return;
    this.sauvegarder(() => this.notifications.succes('Brouillon enregistré.'));
  }

  /** Valide l'étape courante, enregistre puis passe à l'étape suivante. */
  protected suivant(): void {
    const etape = this.etapeCourante();
    if (!this.valider(CHAMPS_PAR_ETAPE[etape])) return;
    this.sauvegarder(() => this.etapeCourante.set(etape + 1));
  }

  /** Dernière étape : vérifie tout le formulaire puis ouvre l'aperçu de l'étude. */
  protected terminer(): void {
    for (const etape of [1, 2, 3]) {
      if (!this.valider(CHAMPS_PAR_ETAPE[etape])) {
        this.etapeCourante.set(etape);
        return;
      }
    }
    const creation = this.statut() === 'brouillon' && !this.id();
    this.sauvegarder((id) => {
      this.notifications.succes(creation ? 'Étude créée.' : 'Étude enregistrée.');
      this.router.navigate(['/etude-marche', id, 'apercu']);
    });
  }

  /**
   * Vérifie les champs donnés. En mode brouillon, les autres champs ne sont contrôlés
   * que s'ils sont remplis (un nombre mal saisi bloque quand même l'enregistrement).
   */
  private valider(champs: Champ[], brouillon = false): boolean {
    let valide = true;
    const aVerifier = brouillon ? (Object.keys(this.formulaire.controls) as Champ[]) : champs;
    for (const champ of aVerifier) {
      const controle = this.formulaire.controls[champ];
      const obligatoire = champs.includes(champ);
      const enErreur = obligatoire ? controle.invalid : controle.invalid && !controle.hasError('required');
      if (enErreur) {
        controle.markAsTouched();
        valide = false;
      }
    }
    if (!valide) {
      this.notifications.erreur('Vérifiez les champs signalés avant de continuer.');
      // En brouillon, ouvre l'étape du premier champ en erreur
      if (brouillon) {
        const etape = [1, 2, 3].find((e) =>
          CHAMPS_PAR_ETAPE[e].some((c) => this.formulaire.controls[c].invalid && this.formulaire.controls[c].touched),
        );
        if (etape) this.etapeCourante.set(etape);
      }
    }
    return valide;
  }

  private saisie(): EtudeSaisie {
    const v = this.formulaire.getRawValue();
    const nombre = (texte: string) => {
      const n = lireNombre(texte);
      return n === null || Number.isNaN(n) ? null : n;
    };
    const saisie: EtudeSaisie = {
      titre: v.titre.trim(),
      secteur: Number(v.secteur),
      cible: v.cible.trim(),
      zone_geographique: v.zone_geographique,
      description_offre: v.description_offre.trim(),
      prix_propose: nombre(v.prix_propose),
      hypotheses: v.hypotheses.trim(),
    };
    const taille = nombre(v.taille_marche);
    const croissance = nombre(v.taux_croissance);
    if (taille !== null) saisie.taille_marche = taille;
    if (croissance !== null) saisie.taux_croissance = croissance;
    return saisie;
  }

  private sauvegarder(ensuite: (id: number) => void): void {
    const id = this.etudeId();
    const requete: Observable<EtudeMarche> =
      id === null
        ? this.api.creerEtude({
            ...this.saisie(),
            projet_id: environment.utilisateur.projetId,
            entrepreneur_id: environment.utilisateur.entrepreneurId,
          })
        : this.api.modifierEtude(id, this.saisie());

    this.enregistrement.set(true);
    requete.subscribe({
      next: (etude) => {
        this.enregistrement.set(false);
        this.etudeId.set(etude.id);
        this.statut.set(etude.statut);
        this.derniereSauvegarde.set(etude.date_mise_a_jour);
        if (id === null) {
          // L'étude existe désormais : l'URL devient celle de la modification
          this.location.replaceState(`/etude-marche/${etude.id}/modifier`);
        }
        this.chargerComparaison();
        ensuite(etude.id);
      },
      error: (e: unknown) => {
        this.enregistrement.set(false);
        if (appliquerErreursServeur(this.formulaire, e)) {
          const etape = [1, 2, 3].find((n) =>
            CHAMPS_PAR_ETAPE[n].some((c) => this.formulaire.controls[c].hasError('serveur')),
          );
          if (etape) this.etapeCourante.set(etape);
        }
        this.notifications.erreur(messageErreur(e, "Impossible d'enregistrer l'étude."));
      },
    });
  }
}
