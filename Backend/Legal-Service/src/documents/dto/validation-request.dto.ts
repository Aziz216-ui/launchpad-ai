import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class ValidationRequestDto {
  @ApiProperty({
    example: 'client-usr-4590',
    description: 'Identifiant du client soumettant le document pour validation',
  })
  @IsString()
  @IsNotEmpty()
  clientId: string;
}
