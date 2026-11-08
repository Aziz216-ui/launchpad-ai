import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';
import { DocumentType } from '../../common/enums/document-type.enum';

export class GenerateDocumentDto {
  @ApiProperty({
    enum: DocumentType,
    example: DocumentType.STATUTS,
    description: 'Type de document juridique à générer',
  })
  @IsEnum(DocumentType, {
    message: 'Le type doit être STATUTS, CONTRAT, NDA ou PV',
  })
  @IsNotEmpty()
  type: DocumentType;

  @ApiProperty({
    example: 'proj-8912-tech',
    description: 'Identifiant du projet associé',
  })
  @IsString()
  @IsNotEmpty()
  projetId: string;

  @ApiProperty({
    example: {
      denomination: 'InnovTech SAS',
      forme: 'SAS',
      capital: 10000,
      siegeSocial: '10 Rue de la Paix, 75002 Paris',
      objetSocial: 'Développement de solutions logicielles et IA',
      dirigeant: 'Alice Durand',
      associes: ['Alice Durand', 'Bob Martin'],
    },
    description:
      'Paramètres variables du document juridique (dénomination, parties, capital, etc.)',
    required: false,
  })
  @IsObject()
  @IsOptional()
  params?: Record<string, any>;
}
