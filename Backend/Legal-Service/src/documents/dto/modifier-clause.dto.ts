import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ModifierClauseDto {
  @ApiProperty({
    example:
      'La société a pour objet social le conseil en stratégie d’entreprise et développement numérique.',
    description: 'Nouveau texte intégral de la clause',
  })
  @IsString()
  @IsNotEmpty()
  texte: string;

  @ApiProperty({
    example: 'Objet social étendu',
    description: 'Nouveau titre optionnel de la clause',
    required: false,
  })
  @IsString()
  @IsOptional()
  titre?: string;
}
