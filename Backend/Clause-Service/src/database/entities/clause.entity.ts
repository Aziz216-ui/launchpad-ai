import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

// Le document parent appartient au Legal-Service (autre base de données) :
// on ne garde que son identifiant, sans clé étrangère ni relation TypeORM.
@Entity('clauses')
@Index(['documentId', 'numero'], { unique: true })
export class Clause {
  @ApiProperty({
    example: 'd8c22d70-388a-4d7a-b5e1-8f5b8df4c4cb',
    description: 'Identifiant unique de la clause',
  })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({
    example: 1,
    description: 'Numéro d’ordre de la clause au sein du document',
  })
  @Column({ type: 'int' })
  numero: number;

  @ApiProperty({
    example: 'Objet social',
    description: 'Titre ou en-tête optionnel de la clause',
    required: false,
  })
  @Column({ type: 'varchar', length: 255, nullable: true })
  titre?: string;

  @ApiProperty({
    example: 'La société a pour objet le développement de solutions logicielles...',
    description: 'Texte intégral de la clause',
  })
  @Column({ type: 'text' })
  texte: string;

  @ApiProperty({
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    description: 'ID du document juridique parent (géré par le Legal-Service)',
  })
  @Column({ type: 'uuid' })
  documentId: string;

  @ApiProperty({ example: '2026-10-19T10:00:00.000Z' })
  @CreateDateColumn()
  createdAt: Date;

  @ApiProperty({ example: '2026-10-19T14:00:00.000Z' })
  @UpdateDateColumn()
  updatedAt: Date;
}
