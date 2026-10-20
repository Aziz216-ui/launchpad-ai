import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class SignerDocumentDto {
  @ApiPropertyOptional({
    example: 'Me Laurent Dupont',
    description: 'Nom ou signature de l’avocat validant',
  })
  @IsString()
  @IsOptional()
  avocat?: string;
}
