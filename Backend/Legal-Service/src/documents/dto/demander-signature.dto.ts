import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsString } from 'class-validator';

export class DemanderSignatureDto {
  @ApiProperty({
    example: ['alice@startup.io', 'bob.investisseur@capital.fr'],
    description: 'Liste des emails ou identifiants des signataires invités',
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  signataires: string[];
}
