import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayNotEmpty, IsArray, IsUUID, ValidateNested } from 'class-validator';
import { ClauseContenuDto } from './creer-clause.dto';

export class CreerClausesDto {
  @ApiProperty({
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    description: 'ID du document juridique parent',
  })
  @IsUUID()
  documentId: string;

  @ApiProperty({
    type: [ClauseContenuDto],
    description: 'Clauses à créer pour ce document',
  })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => ClauseContenuDto)
  clauses: ClauseContenuDto[];
}
