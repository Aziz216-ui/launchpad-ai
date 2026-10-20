import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DocumentJuridique } from '../../database/entities/document-juridique.entity';
import { DocumentStatut } from '../../common/enums/document-statut.enum';
import {
  DOCUMENT_EVENTS,
  DocumentSignatureRequestedEvent,
} from '../../common/events/document.events';

export interface StatutSignatureResult {
  documentId: string;
  statut: DocumentStatut;
  isSigne: boolean;
  signataires: string[];
  version: number;
  signedAt?: Date | null;
}

@Injectable()
export class WorkflowSignatureService {
  private readonly logger = new Logger(WorkflowSignatureService.name);

  constructor(
    @InjectRepository(DocumentJuridique)
    private readonly documentRepository: Repository<DocumentJuridique>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async demanderSignature(
    id: string,
    signataires: string[],
  ): Promise<DocumentJuridique> {
    const doc = await this.documentRepository.findOne({
      where: { id },
      relations: ['clauses', 'commentaires'],
    });

    if (!doc) {
      throw new NotFoundException(`Document juridique introuvable avec l'ID ${id}`);
    }

    if (doc.isArchived) {
      throw new ConflictException(
        'Le document est archivé et se trouve en lecture seule',
      );
    }

    // Règle métier : la demande de signature requiert que le document soit VALIDE
    if (doc.statut !== DocumentStatut.VALIDE) {
      throw new ConflictException(
        `La signature ne peut être demandée que pour un document au statut VALIDE (statut actuel: ${doc.statut})`,
      );
    }

    doc.signataires = signataires;
    const saved = await this.documentRepository.save(doc);

    this.eventEmitter.emit(
      DOCUMENT_EVENTS.SIGNATURE_REQUESTED,
      new DocumentSignatureRequestedEvent(saved.id, signataires, saved.projetId),
    );

    this.logger.log(
      `Demande de signature enregistrée pour doc ${id} avec signataires: ${signataires.join(', ')}`,
    );
    return saved;
  }

  async getStatutSignature(id: string): Promise<StatutSignatureResult> {
    const doc = await this.documentRepository.findOne({ where: { id } });

    if (!doc) {
      throw new NotFoundException(`Document juridique introuvable avec l'ID ${id}`);
    }

    return {
      documentId: doc.id,
      statut: doc.statut,
      isSigne: doc.statut === DocumentStatut.SIGNE,
      signataires: doc.signataires || [],
      version: doc.version,
      signedAt: doc.statut === DocumentStatut.SIGNE ? doc.updatedAt : null,
    };
  }
}
