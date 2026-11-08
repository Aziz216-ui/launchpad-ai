import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class AjouterCommentaireDto {
  @ApiProperty({
    example: 'La clause de non-concurrence doit être limitée à la région Île-de-France et plafonnée à 12 mois.',
    description: 'Texte ou observation juridique formulée par l’avocat',
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
