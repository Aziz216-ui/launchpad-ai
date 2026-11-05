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
import { RechercheLieuComponent } from '../../components/recherche-lieu.component';
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

const ETAPES = ['March├⌐ cible', 'Mon offre', 'Hypoth├¿ses'];

/** Textes du ┬½ conseil LaunchPad ┬╗ repris de la maquette, un par ├⌐tape. */
const CONSEILS = [
  'D├⌐finissez un march├⌐ pr├⌐cis. Une cible bien d├⌐finie rend vos estimations et votre analyse de la concurrence plus utiles.',
  'Comparez des offres ├⌐quivalentes : m├¬mes services, m├¬me fr├⌐quence de paiement et m├¬mes options incluses.',
  'Une bonne hypoth├¿se est mesurable. Pr├⌐cisez ce que vous voulez v├⌐rifier et comment vous le testerez.',
];

/** Cr├⌐ation et modification d'une ├⌐tude en 3 ├⌐tapes (maquette Creation.dc.html). */
@Component({
  selector: 'app-etude-formulaire',
  imports: [ReactiveFormsModule, RouterLink, DatePipe, BadgeComponent, FieldErrorComponent, LoaderComponent, RechercheLieuComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './etude-formulaire.page.html',
  styleUrl: './etude-formulaire.page.scss',
})
export class EtudeFormulairePage implements OnInit {
  private readonly api = inject(MarketApiService);
  private readonly notifications = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly location = inject(Location);

  /** Param├¿tre de route (:id) en modification. */
  readonly id = input<string>();
  /** ?etape=2 : ouvre directement une ├⌐tape (liens ┬½ Modifier mon prix ┬╗, ┬½ Revoir mes hypoth├¿ses ┬╗). */
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

  /** Encadr├⌐ ┬½ Votre ├⌐tude en bref ┬╗, mis ├á jour pendant la saisie. */
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
      titre: v.titre || 'ΓÇö',
      secteur: this.secteurs().find((s) => s.id === Number(v.secteur))?.nom ?? 'ΓÇö',
      zone: v.zone_geographique || 'ΓÇö',
      taille: taille === null ? 'ΓÇö' : `${formatMontant(taille, true)} / an`,
      croissance: croissance === null ? 'ΓÇö' : `${formatPourcentage(croissance, true)} / an`,
      prix: prix === null ? 'ΓÇö' : formatMontant(prix),
    };
  });

  /** Aide du champ ┬½ Taille du march├⌐ ┬╗ : zone saisie et ann├⌐e en cours (maquette ┬½ March├⌐ fran├ºais estim├⌐ pour 2026 ┬╗). */
  protected readonly aideTailleMarche = computed(() => {
    const zone = this.valeurs().zone_geographique;
    const annee = new Date().getFullYear();
    return zone ? `March├⌐ ${zone} estim├⌐ pour ${annee}` : 'Montant annuel estim├⌐ du march├⌐';
  });

  /** Encadr├⌐ de l'├⌐tape 1 : r├⌐sum├⌐ du march├⌐ saisi (cible, secteur, zone), affich├⌐ une fois complet. */
  protected readonly encadreMarche = computed(() => {
    const v = this.valeurs();
    const secteur = this.secteurs().find((s) => s.id === Number(v.secteur))?.nom;
    if (!v.cible || !v.zone_geographique || !secteur) return null;
    return `${v.cible.trim()} ┬╖ secteur ${secteur} ┬╖ ${v.zone_geographique}.`;
  });

  /** Encadr├⌐ de l'├⌐tape 2 : prix propos├⌐ compar├⌐ aux concurrents de l'├⌐tude. */
  protected readonly encadrePrix = computed(() => {
    const c = this.comparaison();
    if (!c || c.positionnement === 'inconnu' || c.prix_moyen === null || c.prix_propose === null) return null;
    const titres = {
      economique: 'Un prix accessible, ├á tester sur le terrain.',
      aligne: 'Un prix align├⌐ sur le march├⌐.',
      premium: 'Un prix premium, ├á justifier aupr├¿s de vos clients.',
    };
    const ecart = c.ecart_moyenne_pct;
    const sens = ecart === null ? '' : ecart < 0 ? ' en dessous du march├⌐' : ' au-dessus du march├⌐';
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
        this.erreurChargement.set(messageErreur(e, "Impossible de charger l'├⌐tude."));
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
    this.sauvegarder(() => this.notifications.succes('Brouillon enregistr├⌐.'));
  }

  /** Valide l'├⌐tape courante, enregistre puis passe ├á l'├⌐tape suivante. */
  protected suivant(): void {
    const etape = this.etapeCourante();
    if (!this.valider(CHAMPS_PAR_ETAPE[etape])) return;
    this.sauvegarder(() => this.etapeCourante.set(etape + 1));
  }

  /** Derni├¿re ├⌐tape : v├⌐rifie tout le formulaire puis ouvre l'aper├ºu de l'├⌐tude. */
  protected terminer(): void {
    for (const etape of [1, 2, 3]) {
      if (!this.valider(CHAMPS_PAR_ETAPE[etape])) {
        this.etapeCourante.set(etape);
        return;
      }
    }
    const creation = this.statut() === 'brouillon' && !this.id();
    this.sauvegarder((id) => {
      this.notifications.succes(creation ? '├ëtude cr├⌐├⌐e.' : '├ëtude enregistr├⌐e.');
      this.router.navigate(['/etude-marche', id, 'apercu']);
    });
  }

  /**
   * V├⌐rifie les champs donn├⌐s. En mode brouillon, les autres champs ne sont contr├┤l├⌐s
   * que s'ils sont remplis (un nombre mal saisi bloque quand m├¬me l'enregistrement).
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
      this.notifications.erreur('V├⌐rifiez les champs signal├⌐s avant de continuer.');
      // En brouillon, ouvre l'├⌐tape du premier champ en erreur
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
          // L'├⌐tude existe d├⌐sormais : l'URL devient celle de la modification
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
        this.notifications.erreur(messageErreur(e, "Impossible d'enregistrer l'├⌐tude."));
      },
    });
  }
}
