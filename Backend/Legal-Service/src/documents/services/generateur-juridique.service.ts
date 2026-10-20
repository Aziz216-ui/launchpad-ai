import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DocumentJuridique } from '../../database/entities/document-juridique.entity';
import { Clause } from '../../database/entities/clause.entity';
import { DocumentType } from '../../common/enums/document-type.enum';
import { DocumentStatut } from '../../common/enums/document-statut.enum';

interface TemplateClause {
  numero: number;
  titre: string;
  texte: string;
}

@Injectable()
export class GenerateurJuridiqueService {
  private readonly logger = new Logger(GenerateurJuridiqueService.name);

  constructor(
    @InjectRepository(DocumentJuridique)
    private readonly documentRepository: Repository<DocumentJuridique>,
  ) {}

  async generer(
    type: DocumentType,
    projetId: string,
    params: Record<string, any> = {},
  ): Promise<DocumentJuridique> {
    switch (type) {
      case DocumentType.STATUTS:
        return this.creerStatuts(projetId, params);
      case DocumentType.CONTRAT:
        return this.creerContratPrestation(projetId, params);
      case DocumentType.NDA:
        return this.creerNDA(projetId, params);
      case DocumentType.PV:
        return this.creerProcesVerbal(projetId, params);
      default:
        throw new Error(`Type de document inconnu: ${type}`);
    }
  }

  async creerStatuts(
    projetId: string,
    params: Record<string, any> = {},
  ): Promise<DocumentJuridique> {
    const denomination = params.denomination || 'Startup Inconnue';
    const forme = params.forme || 'SAS';
    const capital = params.capital || 1000;
    const siegeSocial = params.siegeSocial || '10 Rue de la Paix, 75002 Paris';
    const objetSocial =
      params.objetSocial ||
      'Développement de solutions logicielles et services numériques innovants';
    const dirigeant = params.dirigeant || 'Président désigné par les associés';
    const dureeAnnees = params.duree || 99;

    const templateClauses: TemplateClause[] = [
      {
        numero: 1,
        titre: 'Forme et Dénomination',
        texte: `Il est formé entre les soussignés une Société par Actions Simplifiée (${forme}) régie par les dispositions légales applicables et par les présents statuts. La dénomination sociale de la société est : ${denomination}.`,
      },
      {
        numero: 2,
        titre: 'Siège social',
        texte: `Le siège social est fixé à l'adresse suivante : ${siegeSocial}. Il peut être transféré en tout autre lieu du même département ou d'un département limitrophe par simple décision du Président.`,
      },
      {
        numero: 3,
        titre: 'Objet social',
        texte: `La société a pour objet en France et à l'étranger : ${objetSocial}, ainsi que toutes opérations commerciales, financières ou industrielles s'y rattachant directement ou indirectement.`,
      },
      {
        numero: 4,
        titre: 'Durée de la société',
        texte: `La durée de la société est fixée à ${dureeAnnees} ans à compter de son immatriculation au Registre du Commerce et des Sociétés, sauf prorogation ou dissolution anticipée.`,
      },
      {
        numero: 5,
        titre: 'Capital social et Apports',
        texte: `Le capital social est fixé à la somme de ${capital} euros. Il est divisé en actions de valeur nominale identique, souscrites en totalité et libérées conformément aux engagements des associés.`,
      },
      {
        numero: 6,
        titre: 'Direction de la société',
        texte: `La société est représentée à l'égard des tiers, dirigée et administrée par un Président : ${dirigeant}, investi des pouvoirs les plus étendus pour agir en toute circonstance au nom de la société.`,
      },
      {
        numero: 7,
        titre: 'Décisions collectives des associés',
        texte: `Les décisions collectives des associés sont prises en assemblée générale ou par consultation écrite. Chaque action donne droit à une voix dans les délibérations.`,
      },
    ];

    return this.enregistrerNouveauDocument(
      projetId,
      DocumentType.STATUTS,
      `Statuts constitutifs ${forme} - ${denomination}`,
      templateClauses,
      params,
    );
  }

  async creerContratPrestation(
    projetId: string,
    params: Record<string, any> = {},
  ): Promise<DocumentJuridique> {
    const prestataire = params.prestataire || 'Le Prestataire';
    const client = params.client || 'Le Client';
    const objet =
      params.objet || 'Prestation de services intellectuels et techniques';
    const montant = params.montant || 5000;
    const delai = params.delai || '3 mois';

    const templateClauses: TemplateClause[] = [
      {
        numero: 1,
        titre: 'Désignation des Parties',
        texte: `Entre les soussignés : ${prestataire}, ci-après dénommé 'Le Prestataire', d'une part, et ${client}, ci-après dénommé 'Le Client', d'autre part.`,
      },
      {
        numero: 2,
        titre: 'Objet du Contrat',
        texte: `Le présent contrat a pour objet la réalisation des prestations suivantes : ${objet}, en toute indépendance et dans le respect des règles de l'art.`,
      },
      {
        numero: 3,
        titre: 'Calendrier et Délais d’exécution',
        texte: `Les prestations débuteront dès la signature des présentes pour une durée estimée à ${delai}, selon les jalons convenus entre les parties.`,
      },
      {
        numero: 4,
        titre: 'Conditions Financières et Paiement',
        texte: `En contrepartie de la bonne exécution des prestations, Le Client s'engage à verser au Prestataire une rémunération globale de ${montant} euros hors taxes, payable sous 30 jours à réception de facture.`,
      },
      {
        numero: 5,
        titre: 'Propriété Intellectuelle',
        texte: `Tous les livrables, codes, documents et créations réalisés dans le cadre de la prestation seront la propriété exclusive du Client après parfait paiement du prix convenu.`,
      },
      {
        numero: 6,
        titre: 'Résiliation et Droit Applicable',
        texte: `Chaque partie pourra résilier le contrat en cas de manquement grave non réparé sous 15 jours après mise en demeure. Le contrat est soumis au droit français et aux tribunaux compétents du ressort du siège du Prestataire.`,
      },
    ];

    return this.enregistrerNouveauDocument(
      projetId,
      DocumentType.CONTRAT,
      `Contrat de prestation de services - ${client}`,
      templateClauses,
      params,
    );
  }

  async creerNDA(
    projetId: string,
    params: Record<string, any> = {},
  ): Promise<DocumentJuridique> {
    const partieA = params.partieA || 'La Partie Émettrice';
    const partieB = params.partieB || 'La Partie Réceptrice';
    const objet =
      params.objet || 'Discussions exploratoires et opportunités de partenariat';
    const dureeMois = params.dureeMois || 24;

    const templateClauses: TemplateClause[] = [
      {
        numero: 1,
        titre: 'Définition des Informations Confidentielles',
        texte: `Sont considérées comme Informations Confidentielles toutes données techniques, financières, commerciales ou stratégiques divulguées par ${partieA} à ${partieB} dans le cadre de : ${objet}.`,
      },
      {
        numero: 2,
        titre: 'Obligations de Confidentialité',
        texte: `La Partie Réceptrice s'engage à garder strictement secrètes les Informations Confidentielles, à ne pas les divulguer à des tiers et à n'autoriser leur accès qu'aux membres de son équipe ayant strictement besoin d'en connaître.`,
      },
      {
        numero: 3,
        titre: 'Durée des Engagements',
        texte: `Les obligations de confidentialité prévues au présent accord demeureront en vigueur pendant une durée de ${dureeMois} mois à compter de la date de signature des présentes.`,
      },
      {
        numero: 4,
        titre: 'Restitution des Documents',
        texte: `À l'expiration des discussions ou sur simple demande écrite, la Partie Réceptrice s'engage à restituer ou détruire sans délai l'ensemble des documents contenant des Informations Confidentielles.`,
      },
      {
        numero: 5,
        titre: 'Loi Applicable et Juridiction',
        texte: `Le présent accord de non-divulgation est régi par le droit français. Tout différend relatif à sa validité ou son exécution sera soumis aux tribunaux compétents.`,
      },
    ];

    return this.enregistrerNouveauDocument(
      projetId,
      DocumentType.NDA,
      `Accord de confidentialité (NDA) - ${partieB}`,
      templateClauses,
      params,
    );
  }

  async creerProcesVerbal(
    projetId: string,
    params: Record<string, any> = {},
  ): Promise<DocumentJuridique> {
    const assembleeType = params.assembleeType || 'Générale Ordinaire';
    const dateSeance = params.dateSeance || new Date().toISOString().split('T')[0];
    const president = params.president || 'Le Président de séance';
    const ordreDuJour =
      params.ordreDuJour ||
      'Approbation des comptes annuels, affectation du résultat, questions diverses';

    const templateClauses: TemplateClause[] = [
      {
        numero: 1,
        titre: 'Ouverture et Composition de la Séance',
        texte: `L'an 2026, le ${dateSeance}, les associés se sont réunis en Assemblée ${assembleeType} sous la présidence de ${president}. Le quorum requis étant atteint, l'assemblée peut valablement délibérer.`,
      },
      {
        numero: 2,
        titre: 'Ordre du Jour',
        texte: `Le Président rappelle l'ordre du jour suivant : ${ordreDuJour}. Les pièces et rapports requis ont été mis à la disposition des associés dans les délais légaux.`,
      },
      {
        numero: 3,
        titre: 'Première Résolution - Approbation des comptes',
        texte: `L'Assemblée Générale, après avoir entendu la lecture des rapports, approuve sans réserve les comptes et opérations de l'exercice écoulé tels qu'ils sont présentés. Cette résolution est adoptée à l'unanimité.`,
      },
      {
        numero: 4,
        titre: 'Deuxième Résolution - Affectation du résultat',
        texte: `L'Assemblée Générale décide d'affecter le résultat net de l'exercice au report à nouveau ou aux réserves légales et facultatives conformément aux propositions de la gérance. Cette résolution est adoptée à l'unanimité.`,
      },
      {
        numero: 5,
        titre: 'Clôture et Mandats',
        texte: `L'ordre du jour étant épuisé et personne ne demandant plus la parole, la séance est levée. Tous pouvoirs sont donnés au porteur d'une copie ou d'un extrait du présent procès-verbal pour effectuer les formalités de publicité légale.`,
      },
    ];

    return this.enregistrerNouveauDocument(
      projetId,
      DocumentType.PV,
      `Procès-Verbal d'Assemblée - ${assembleeType}`,
      templateClauses,
      params,
    );
  }

  private async enregistrerNouveauDocument(
    projetId: string,
    type: DocumentType,
    titre: string,
    templateClauses: TemplateClause[],
    params: Record<string, any>,
  ): Promise<DocumentJuridique> {
    const document = this.documentRepository.create({
      projetId,
      type,
      titre,
      statut: DocumentStatut.BROUILLON,
      version: 1,
      isArchived: false,
      metadata: params,
      commentaires: [],
    });

    const clauses = templateClauses.map((tc) => {
      const clause = new Clause();
      clause.numero = tc.numero;
      clause.titre = tc.titre;
      clause.texte = tc.texte;
      return clause;
    });

    document.clauses = clauses;

    const saved = await this.documentRepository.save(document);
    this.logger.log(
      `Document créé : ID=${saved.id}, Type=${saved.type}, Statut=${saved.statut}, Version=${saved.version}`,
    );
    return saved;
  }
}
