import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

// Le document parent appartient au Legal-Service (autre base de données) :
// on ne garde que son identifiant, sans clé étrangère ni relation TypeORM.
@Entity('commentaires')
export class Commentaire {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Identifiant unique du commentaire',
  })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({
    example: 'Maître Dupont',
    description: 'Auteur du commentaire (avocat ou entrepreneur)',
  })
  @Column({ type: 'varchar', length: 255 })
  auteur: string;

  @ApiProperty({
    example: 'Veuillez préciser la clause de non-concurrence géographique.',
    description: 'Texte du commentaire ou remarque juridique',
  })
  @Column({ type: 'text' })
  texte: string;

  @ApiProperty({
    example: '2026-10-19T14:30:00.000Z',
    description: 'Date de publication du commentaire',
  })
  @CreateDateColumn({ type: 'timestamp' })
  date: Date;

  @ApiProperty({
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    description: 'ID du document juridique parent (géré par le Legal-Service)',
  })
  @Index()
  @Column({ type: 'uuid' })
  documentId: string;
}
