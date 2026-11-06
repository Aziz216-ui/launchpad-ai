import { DataSource } from 'typeorm';
import { DocumentJuridique } from './database/entities/document-juridique.entity';
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
    entities: [DocumentJuridique],
    synchronize: true,
  });

  console.log('Connexion à la base de données PostgreSQL pour le seed...');
  await dataSource.initialize();
  console.log('Connecté avec succès.');

  const docRepo = dataSource.getRepository(DocumentJuridique);

  // Nettoyage préalable optionnel
  console.log('Nettoyage des données existantes...');
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

  console.log('Seed terminé avec succès ! 4 documents créés. Lancez ensuite le seed du Clause-Service et du Commentaire-Service.');
  await dataSource.destroy();
}

seed().catch((err) => {
  console.error('Erreur durant le seed :', err);
  process.exit(1);
});
