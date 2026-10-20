import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class RefuserDocumentDto {
  @ApiProperty({
    example:
      'Capital social incohérent avec les apports déclarés dans l’article 6. Révision requise.',
    description: 'Motif obligatoire justifiant le refus du document juridique',
  })
  @IsString()
  @IsNotEmpty({ message: 'Le motif de refus est obligatoire' })
  motif: string;
}
