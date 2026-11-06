import { DataSource } from 'typeorm';
import { Clause } from './database/entities/clause.entity';

// Clauses des documents créés par le seed du Legal-Service (mêmes UUID fixes).
// Lancer d'abord `npm run seed` dans Legal-Service, puis ici.
const STATUTS_ID = 'a0000000-0000-0000-0000-000000000001';
const CONTRAT_ID = 'b0000000-0000-0000-0000-000000000002';
const NDA_ID = 'c0000000-0000-0000-0000-000000000003';
const PV_ID = 'd0000000-0000-0000-0000-000000000004';

async function seed() {
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'clause_db',
    entities: [Clause],
    synchronize: true,
  });

  console.log('Connexion à la base de données PostgreSQL pour le seed...');
  await dataSource.initialize();
  console.log('Connecté avec succès.');

  const clauseRepo = dataSource.getRepository(Clause);

  console.log('Nettoyage des clauses existantes...');
  await clauseRepo.delete({});

  await clauseRepo.save(
    [
      {
        documentId: STATUTS_ID,
        numero: 1,
        titre: 'Forme et Dénomination',
        texte: 'Il est formé une société par actions simplifiée dénommée AlphaTech Solutions.',
      },
      {
        documentId: STATUTS_ID,
        numero: 2,
        titre: 'Objet social',
        texte: 'Développement de solutions logicielles Saas pour entreprises innovantes.',
      },
      {
        documentId: STATUTS_ID,
        numero: 3,
        titre: 'Capital social',
        texte: 'Le capital social est fixé à 15 000 euros, divisé en 15 000 actions de 1 euro chacune.',
      },
      {
        documentId: CONTRAT_ID,
        numero: 1,
        titre: 'Parties contractantes',
        texte: 'Entre AlphaTech Solutions SAS (Prestataire) et Acme Corp (Client).',
      },
      {
        documentId: CONTRAT_ID,
        numero: 2,
        titre: 'Objet de la prestation',
        texte: 'Déploiement d’une plateforme cloud haute disponibilité et APIs de synchronisation.',
      },
      {
        documentId: CONTRAT_ID,
        numero: 3,
        titre: 'Conditions financières',
        texte: 'Montant forfaitaire de 18 000 € HT payable à 30 jours date d’émission de facture.',
      },
      {
        documentId: NDA_ID,
        numero: 1,
        titre: 'Définition des informations confidentielles',
        texte: 'Toutes les données techniques, financières, commerciales communiquées par les parties.',
      },
      {
        documentId: NDA_ID,
        numero: 2,
        titre: 'Durée de validité',
        texte: 'L’obligation de secret professionnel court pour une durée de 36 mois à compter de la signature.',
      },
      {
        documentId: PV_ID,
        numero: 1,
        titre: 'Adoption des résolutions',
        texte: 'L’ensemble des associés fondateurs adopte à l’unanimité la constitution de la société.',
      },
    ].map((c) => clauseRepo.create(c)),
  );

  console.log('Seed terminé avec succès ! 9 clauses créées.');
  await dataSource.destroy();
}

seed().catch((err) => {
  console.error('Erreur durant le seed :', err);
  process.exit(1);
});
