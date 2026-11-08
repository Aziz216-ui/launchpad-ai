import { ApiProperty } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString } from 'class-validator';

export class ModifierDocumentDto {
  @ApiProperty({
    example: 'Statuts constitutifs SAS InnovTech - Version Révisée',
    description: 'Nouveau titre du document',
    required: false,
  })
  @IsString()
  @IsOptional()
  titre?: string;

  @ApiProperty({
    example: { capital: 20000, dureeExercice: 12 },
    description: 'Modifications ou ajouts aux métadonnées / paramètres du document',
    required: false,
  })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}
