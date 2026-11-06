import { DataSource } from 'typeorm';
import { Commentaire } from './database/entities/commentaire.entity';

// Commentaires des documents créés par le seed du Legal-Service (mêmes UUID fixes).
// Lancer d'abord `npm run seed` dans Legal-Service, puis ici.
const CONTRAT_ID = 'b0000000-0000-0000-0000-000000000002';
const NDA_ID = 'c0000000-0000-0000-0000-000000000003';

async function seed() {
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'commentaire_db',
    entities: [Commentaire],
    synchronize: true,
  });

  console.log('Connexion à la base de données PostgreSQL pour le seed...');
  await dataSource.initialize();
  console.log('Connecté avec succès.');

  const commRepo = dataSource.getRepository(Commentaire);

  console.log('Nettoyage des commentaires existants...');
  await commRepo.delete({});

  await commRepo.save([
    commRepo.create({
      auteur: 'Alice Entrepreneur',
      texte: 'Merci de vérifier la clause 3 concernant les conditions de paiement et pénalités de retard.',
      date: new Date(Date.now() - 3600000 * 2),
      documentId: CONTRAT_ID,
    }),
    commRepo.create({
      auteur: 'Me Marc Dupont',
      texte: 'Document validé sans réserve. Conforme à la législation en vigueur.',
      date: new Date(Date.now() - 1800000),
      documentId: NDA_ID,
    }),
  ]);

  console.log('Seed terminé avec succès ! 2 commentaires créés.');
  await dataSource.destroy();
}

seed().catch((err) => {
  console.error('Erreur durant le seed :', err);
  process.exit(1);
});
