import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class DemanderInformationsDto {
  @ApiProperty({
    example:
      'Pourriez-vous fournir les justificatifs de domiciliation du siège social ainsi que la liste des souscripteurs ?',
    description: 'Question ou demande de précisions adressée au porteur de projet',
  })
  @IsString()
  @IsNotEmpty({ message: 'La question est obligatoire' })
  question: string;

  @ApiPropertyOptional({
    example: 'Me Laurent Dupont',
    description: 'Nom ou référence de l’avocat demandeur',
  })
  @IsString()
  @IsOptional()
  avocat?: string;
}
