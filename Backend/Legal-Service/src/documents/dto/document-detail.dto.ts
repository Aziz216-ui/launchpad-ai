import { ApiProperty } from '@nestjs/swagger';
import { DocumentJuridique } from '../../database/entities/document-juridique.entity';
import { Clause } from '../../clients/models/clause.model';
import { Commentaire } from '../../clients/models/commentaire.model';

// Document complet : le document (Legal-Service) agrégé avec ses clauses
// (Clause-Service) et ses commentaires (Commentaire-Service).
export class DocumentDetailDto extends DocumentJuridique {
  @ApiProperty({
    type: () => [Clause],
    description: 'Clauses du document juridique (Clause-Service)',
  })
  clauses: Clause[];

  @ApiProperty({
    type: () => [Commentaire],
    description: 'Commentaires et remarques laissés par les avocats/entrepreneurs (Commentaire-Service)',
  })
  commentaires: Commentaire[];
}
