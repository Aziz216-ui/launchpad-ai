import { ApiProperty } from '@nestjs/swagger';

// Clause telle que renvoyée par le Clause-Service (pas une entité locale).
export class Clause {
  @ApiProperty({
    example: 'd8c22d70-388a-4d7a-b5e1-8f5b8df4c4cb',
    description: 'Identifiant unique de la clause',
  })
  id: string;

  @ApiProperty({
    example: 1,
    description: 'Numéro d’ordre de la clause au sein du document',
  })
  numero: number;

  @ApiProperty({
    example: 'Objet social',
    description: 'Titre ou en-tête optionnel de la clause',
    required: false,
  })
  titre?: string;

  @ApiProperty({
    example: 'La société a pour objet le développement de solutions logicielles...',
    description: 'Texte intégral de la clause',
  })
  texte: string;

  @ApiProperty({
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    description: 'ID du document juridique parent',
  })
  documentId: string;

  @ApiProperty({ example: '2026-10-19T10:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-10-19T14:00:00.000Z' })
  updatedAt: Date;
}

export interface ClauseContenu {
  numero: number;
  titre?: string;
  texte: string;
}
