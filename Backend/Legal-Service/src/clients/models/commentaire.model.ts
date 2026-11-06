import { ApiProperty } from '@nestjs/swagger';

// Commentaire tel que renvoyé par le Commentaire-Service (pas une entité locale).
export class Commentaire {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Identifiant unique du commentaire',
  })
  id: string;

  @ApiProperty({
    example: 'Maître Dupont',
    description: 'Auteur du commentaire (avocat ou entrepreneur)',
  })
  auteur: string;

  @ApiProperty({
    example: 'Veuillez préciser la clause de non-concurrence géographique.',
    description: 'Texte du commentaire ou remarque juridique',
  })
  texte: string;

  @ApiProperty({
    example: '2026-10-19T14:30:00.000Z',
    description: 'Date de publication du commentaire',
  })
  date: Date;

  @ApiProperty({
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    description: 'ID du document juridique parent',
  })
  documentId: string;
}
