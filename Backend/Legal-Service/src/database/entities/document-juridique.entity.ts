import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { DocumentType } from '../../common/enums/document-type.enum';
import { DocumentStatut } from '../../common/enums/document-statut.enum';
import { Clause } from './clause.entity';
import { Commentaire } from './commentaire.entity';

@Entity('documents_juridiques')
export class DocumentJuridique {
  @ApiProperty({
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    description: 'Identifiant unique (UUID) du document juridique',
  })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({
    example: 'Statuts constitutifs SAS - InnovTech',
    description: 'Titre ou désignation du document',
    required: false,
  })
  @Column({ type: 'varchar', length: 255, default: 'Document Juridique' })
  titre: string;

  @ApiProperty({
    example: 'proj-8912-tech',
    description: 'Identifiant du projet associé dans LaunchPad',
  })
  @Column({ type: 'varchar', length: 255 })
  projetId: string;

  @ApiProperty({
    enum: DocumentType,
    example: DocumentType.STATUTS,
    description: 'Type de document juridique',
  })
  @Column({
    type: 'enum',
    enum: DocumentType,
  })
  type: DocumentType;

  @ApiProperty({
    enum: DocumentStatut,
    example: DocumentStatut.BROUILLON,
    description: 'Statut du document dans le cycle de vie',
  })
  @Column({
    type: 'enum',
    enum: DocumentStatut,
    default: DocumentStatut.BROUILLON,
  })
  statut: DocumentStatut;

  @ApiProperty({
    example: 1,
    description: 'Numéro de version incrémenté à chaque modification',
  })
  @Column({ type: 'int', default: 1 })
  version: number;

  @ApiProperty({
    example: false,
    description: 'Indique si le document est archivé (lecture seule)',
  })
  @Column({ type: 'boolean', default: false })
  isArchived: boolean;

  @ApiProperty({
    example: null,
    description: 'Date d’archivage du document',
    required: false,
    nullable: true,
  })
  @Column({ type: 'timestamp', nullable: true })
  archivedAt?: Date | null;

  @ApiProperty({
    example: null,
    description: 'Motif en cas de refus par l’avocat',
    required: false,
    nullable: true,
  })
  @Column({ type: 'text', nullable: true })
  motifRefus?: string | null;

  @ApiProperty({
    example: null,
    description: 'Identifiant du client ayant demandé la validation',
    required: false,
    nullable: true,
  })
  @Column({ type: 'varchar', length: 255, nullable: true })
  clientId?: string | null;

  @ApiProperty({
    example: ['fondateur1@startup.io', 'fondateur2@startup.io'],
    description: 'Liste des signataires désignés',
    required: false,
    nullable: true,
  })
  @Column({ type: 'simple-array', nullable: true })
  signataires?: string[] | null;

  @ApiProperty({
    example: { denomination: 'InnovTech SAS', capital: 10000 },
    description: 'Paramètres et métadonnées variables du document',
    required: false,
  })
  @Column({ type: 'jsonb', nullable: true, default: {} })
  metadata?: Record<string, any>;

  @ApiProperty({
    example: '2026-10-19T10:00:00.000Z',
    description: 'Date de création du document',
  })
  @CreateDateColumn()
  createdAt: Date;

  @ApiProperty({
    example: '2026-10-19T14:00:00.000Z',
    description: 'Date de dernière modification',
  })
  @UpdateDateColumn()
  updatedAt: Date;

  @ApiProperty({
    type: () => [Clause],
    description: 'Clauses du document juridique',
  })
  @OneToMany(() => Clause, (clause) => clause.document, {
    cascade: true,
    eager: true,
  })
  clauses: Clause[];

  @ApiProperty({
    type: () => [Commentaire],
    description: 'Commentaires et remarques laissés par les avocats/entrepreneurs',
  })
  @OneToMany(() => Commentaire, (commentaire) => commentaire.document, {
    cascade: true,
    eager: true,
  })
  commentaires: Commentaire[];
}
