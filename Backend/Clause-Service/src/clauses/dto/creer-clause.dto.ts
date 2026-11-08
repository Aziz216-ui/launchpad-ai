import { ApiProperty } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class ClauseContenuDto {
  @ApiProperty({
    example: 1,
    description: 'Numéro d’ordre de la clause au sein du document',
  })
  @IsInt()
  @Min(1)
  numero: number;

  @ApiProperty({
    example: 'Objet social',
    description: 'Titre optionnel de la clause',
    required: false,
  })
  @IsString()
  @IsOptional()
  titre?: string;

  @ApiProperty({
    example: 'La société a pour objet le développement de solutions logicielles...',
    description: 'Texte intégral de la clause',
  })
  @IsString()
  @IsNotEmpty()
  texte: string;
}

export class CreerClauseDto extends ClauseContenuDto {
  @ApiProperty({
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    description: 'ID du document juridique parent',
  })
  @IsUUID()
  documentId: string;
}
