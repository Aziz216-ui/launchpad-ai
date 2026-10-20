import { DataSource } from 'typeorm';
import { DocumentJuridique } from './database/entities/document-juridique.entity';
import { Clause } from './database/entities/clause.entity';
import { Commentaire } from './database/entities/commentaire.entity';
import { DocumentType } from './common/enums/document-type.enum';
import { DocumentStatut } from './common/enums/document-statut.enum';

async function seed() {
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'legal_db',
    entities: [DocumentJuridique, Clause, Commentaire],
    synchronize: true,
  });

  console.log('Connexion à la base de données PostgreSQL pour le seed...');
  await dataSource.initialize();
  console.log('Connecté avec succès.');

  const docRepo = dataSource.getRepository(DocumentJuridique);
  const clauseRepo = dataSource.getRepository(Clause);
  const commRepo = dataSource.getRepository(Commentaire);

  // Nettoyage préalable optionnel
  console.log('Nettoyage des données existantes...');
  await clauseRepo.delete({});
  await commRepo.delete({});
  await docRepo.delete({});

  // 1. STATUTS en BROUILLON
  console.log('Création du document 1 : Statuts (BROUILLON)...');
  const statuts = docRepo.create({
    id: 'a0000000-0000-0000-0000-000000000001',
    projetId: 'proj-alphatech-2026',
    titre: 'Statuts constitutifs SAS - AlphaTech Solutions',
    type: DocumentType.STATUTS,
    statut: DocumentStatut.BROUILLON,
    version: 1,
    isArchived: false,
    metadata: {
      denomination: 'AlphaTech Solutions',
      forme: 'SAS',
      capital: 15000,
      siege: '14 Rue Turbigo, 75003 Paris',
    },
  });
  await docRepo.save(statuts);

  await clauseRepo.save([
    clauseRepo.create({
      numero: 1,
      titre: 'Forme et Dénomination',
      texte: 'Il est formé une société par actions simplifiée dénommée AlphaTech Solutions.',
      documentId: statuts.id,
    }),
    clauseRepo.create({
      numero: 2,
      titre: 'Objet social',
      texte: 'Développement de solutions logicielles Saas pour entreprises innovantes.',
      documentId: statuts.id,
    }),
    clauseRepo.create({
      numero: 3,
      titre: 'Capital social',
      texte: 'Le capital social est fixé à 15 000 euros, divisé en 15 000 actions de 1 euro chacune.',
      documentId: statuts.id,
    }),
  ]);

  // 2. CONTRAT en EN_VALIDATION
  console.log('Création du document 2 : Contrat de Prestation (EN_VALIDATION)...');
  const contrat = docRepo.create({
    id: 'b0000000-0000-0000-0000-000000000002',
    projetId: 'proj-alphatech-2026',
    titre: 'Contrat de prestation de développement logiciel - Client Acme Corp',
    type: DocumentType.CONTRAT,
    statut: DocumentStatut.EN_VALIDATION,
    version: 2,
    clientId: 'client-acme-42',
    isArchived: false,
    metadata: {
      prestataire: 'AlphaTech Solutions SAS',
      client: 'Acme Corp SAS',
      montant: 18000,
      delai: '4 mois',
    },
  });
  await docRepo.save(contrat);

  await clauseRepo.save([
    clauseRepo.create({
      numero: 1,
      titre: 'Parties contractantes',
      texte: 'Entre AlphaTech Solutions SAS (Prestataire) et Acme Corp (Client).',
      documentId: contrat.id,
    }),
    clauseRepo.create({
      numero: 2,
      titre: 'Objet de la prestation',
      texte: 'Déploiement d’une plateforme cloud haute disponibilité et APIs de synchronisation.',
      documentId: contrat.id,
    }),
    clauseRepo.create({
      numero: 3,
      titre: 'Conditions financières',
      texte: 'Montant forfaitaire de 18 000 € HT payable à 30 jours date d’émission de facture.',
      documentId: contrat.id,
    }),
  ]);

  await commRepo.save([
    commRepo.create({
      auteur: 'Alice Entrepreneur',
      texte: 'Merci de vérifier la clause 3 concernant les conditions de paiement et pénalités de retard.',
      date: new Date(Date.now() - 3600000 * 2),
      documentId: contrat.id,
    }),
  ]);

  // 3. NDA en statut VALIDE
  console.log('Création du document 3 : NDA (VALIDE)...');
  const nda = docRepo.create({
    id: 'c0000000-0000-0000-0000-000000000003',
    projetId: 'proj-alphatech-2026',
    titre: 'Accord de confidentialité bilatéral - Partenaire DataCore',
    type: DocumentType.NDA,
    statut: DocumentStatut.VALIDE,
    version: 3,
    isArchived: false,
    signataires: ['alice@alphatech.io', 'direction@datacore.fr'],
    metadata: {
      dureeMois: 36,
      parties: ['AlphaTech Solutions', 'DataCore SARL'],
    },
  });
  await docRepo.save(nda);

  await clauseRepo.save([
    clauseRepo.create({
      numero: 1,
      titre: 'Définition des informations confidentielles',
      texte: 'Toutes les données techniques, financières, commerciales communiquées par les parties.',
      documentId: nda.id,
    }),
    clauseRepo.create({
      numero: 2,
      titre: 'Durée de validité',
      texte: 'L’obligation de secret professionnel court pour une durée de 36 mois à compter de la signature.',
      documentId: nda.id,
    }),
  ]);

  await commRepo.save([
    commRepo.create({
      auteur: 'Me Marc Dupont',
      texte: 'Document validé sans réserve. Conforme à la législation en vigueur.',
      date: new Date(Date.now() - 1800000),
      documentId: nda.id,
    }),
  ]);

  // 4. PV d'Assemblée en statut SIGNE
  console.log('Création du document 4 : PV d’Assemblée (SIGNE)...');
  const pv = docRepo.create({
    id: 'd0000000-0000-0000-0000-000000000004',
    projetId: 'proj-alphatech-2026',
    titre: 'Procès-Verbal de l’Assemblée Générale Constitutive',
    type: DocumentType.PV,
    statut: DocumentStatut.SIGNE,
    version: 2,
    isArchived: false,
    signataires: ['alice@alphatech.io', 'bob@alphatech.io'],
    metadata: {
      assemblee: 'Constitutive',
      date: '2026-10-15',
    },
  });
  await docRepo.save(pv);

  await clauseRepo.save([
    clauseRepo.create({
      numero: 1,
      titre: 'Adoption des résolutions',
      texte: 'L’ensemble des associés fondateurs adopte à l’unanimité la constitution de la société.',
      documentId: pv.id,
    }),
  ]);

  console.log('Seed terminé avec succès ! 4 documents créés.');
  await dataSource.destroy();
}

seed().catch((err) => {
  console.error('Erreur durant le seed :', err);
  process.exit(1);
});
