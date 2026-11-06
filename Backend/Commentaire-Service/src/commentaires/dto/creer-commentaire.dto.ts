import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreerCommentaireDto {
  @ApiProperty({
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    description: 'ID du document juridique commenté',
  })
  @IsUUID()
  documentId: string;

  @ApiProperty({
    example: 'La clause de non-concurrence doit être limitée à la région Île-de-France et plafonnée à 12 mois.',
    description: 'Texte ou observation juridique',
  })
  @IsString()
  @IsNotEmpty({ message: 'Le texte du commentaire est requis' })
  texte: string;

  @ApiProperty({
    example: 'Maître Laurent Dupont',
    description: 'Nom ou identifiant de l’auteur (défaut: Avocat)',
    required: false,
  })
  @IsString()
  @IsOptional()
  auteur?: string;
}
