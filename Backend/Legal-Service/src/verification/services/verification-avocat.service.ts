import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DocumentJuridique } from '../../database/entities/document-juridique.entity';
import { Clause } from '../../database/entities/clause.entity';
import { Commentaire } from '../../database/entities/commentaire.entity';
import { DocumentStatut } from '../../common/enums/document-statut.enum';
import {
  DOCUMENT_EVENTS,
  DocumentInfoRequestedEvent,
  DocumentSignedEvent,
  DocumentStatusChangedEvent,
} from '../../common/events/document.events';

@Injectable()
export class VerificationAvocatService {
  private readonly logger = new Logger(VerificationAvocatService.name);

  constructor(
    @InjectRepository(DocumentJuridique)
    private readonly documentRepository: Repository<DocumentJuridique>,
    @InjectRepository(Clause)
    private readonly clauseRepository: Repository<Clause>,
    @InjectRepository(Commentaire)
    private readonly commentaireRepository: Repository<Commentaire>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async consulterDocument(id: string): Promise<DocumentJuridique> {
    const doc = await this.documentRepository.findOne({
      where: { id },
      relations: ['clauses', 'commentaires'],
      order: {
        clauses: { numero: 'ASC' },
        commentaires: { date: 'ASC' },
      },
    });

    if (!doc) {
      throw new NotFoundException(`Document juridique introuvable avec l'ID ${id}`);
    }

    return doc;
  }

  async modifierClause(
    docId: string,
    numero: number,
    texte: string,
  ): Promise<Clause> {
    const doc = await this.consulterDocument(docId);

    if (doc.isArchived) {
      throw new ConflictException(
        'Le document est archivé et se trouve en lecture seule',
      );
    }

    const clause = await this.clauseRepository.findOne({
      where: { documentId: docId, numero },
    });

    if (!clause) {
      throw new NotFoundException(
        `Clause n°${numero} introuvable pour le document ${docId}`,
      );
    }

    clause.texte = texte;
    const savedClause = await this.clauseRepository.save(clause);

    // Incrémentation de la version
    doc.version += 1;
    await this.documentRepository.save(doc);

    this.logger.log(
      `Avocat a modifié la clause ${numero} du document ${docId} -> Version ${doc.version}`,
    );
    return savedClause;
  }

  async ajouterCommentaire(
    docId: string,
    texte: string,
    auteur: string,
  ): Promise<Commentaire> {
    const doc = await this.consulterDocument(docId);

    if (doc.isArchived) {
      throw new ConflictException(
        'Le document est archivé et se trouve en lecture seule',
      );
    }

    const commentaire = this.commentaireRepository.create({
      documentId: docId,
      auteur: auteur || 'Avocat',
      texte,
      date: new Date(),
    });

    const savedCommentaire = await this.commentaireRepository.save(commentaire);
    this.logger.log(
      `Nouveau commentaire ajouté par ${auteur} sur le document ${docId}`,
    );
    return savedCommentaire;
  }

  async accepter(docId: string): Promise<DocumentJuridique> {
    const doc = await this.consulterDocument(docId);

    if (doc.isArchived) {
      throw new ConflictException(
        'Le document est archivé et se trouve en lecture seule',
      );
    }

    // Machine à états : acceptation permise uniquement depuis EN_VALIDATION
    if (doc.statut !== DocumentStatut.EN_VALIDATION) {
      throw new ConflictException(
        `Impossible d'accepter le document : le statut actuel est '${doc.statut}', statut attendu: '${DocumentStatut.EN_VALIDATION}'`,
      );
    }

    doc.statut = DocumentStatut.VALIDE;
    doc.motifRefus = null;

    const saved = await this.documentRepository.save(doc);

    this.eventEmitter.emit(
      DOCUMENT_EVENTS.STATUS_CHANGED,
      new DocumentStatusChangedEvent(
        saved.id,
        DocumentStatut.EN_VALIDATION,
        DocumentStatut.VALIDE,
        saved.projetId,
      ),
    );

    this.logger.log(`Document ${docId} validé avec succès par l'avocat`);
    return saved;
  }

  async refuser(docId: string, motif: string): Promise<DocumentJuridique> {
    if (!motif || motif.trim() === '') {
      throw new BadRequestException('Le motif est obligatoire lors d’un refus');
    }

    const doc = await this.consulterDocument(docId);

    if (doc.isArchived) {
      throw new ConflictException(
        'Le document est archivé et se trouve en lecture seule',
      );
    }

    // Machine à états : refus permis uniquement depuis EN_VALIDATION
    if (doc.statut !== DocumentStatut.EN_VALIDATION) {
      throw new ConflictException(
        `Impossible de refuser le document : le statut actuel est '${doc.statut}', statut attendu: '${DocumentStatut.EN_VALIDATION}'`,
      );
    }

    doc.statut = DocumentStatut.REFUSE;
    doc.motifRefus = motif;

    // Enregistrer également le motif comme commentaire traçable
    const commentaire = this.commentaireRepository.create({
      documentId: docId,
      auteur: 'Avocat (Motif de refus)',
      texte: motif,
      date: new Date(),
    });
    await this.commentaireRepository.save(commentaire);

    const saved = await this.documentRepository.save(doc);

    this.eventEmitter.emit(
      DOCUMENT_EVENTS.STATUS_CHANGED,
      new DocumentStatusChangedEvent(
        saved.id,
        DocumentStatut.EN_VALIDATION,
        DocumentStatut.REFUSE,
        saved.projetId,
        motif,
      ),
    );

    this.logger.log(`Document ${docId} refusé par l'avocat. Motif: ${motif}`);
    return saved;
  }

  async demanderInformations(
    docId: string,
    question: string,
    avocatName: string,
  ): Promise<DocumentJuridique> {
    if (!question || question.trim() === '') {
      throw new BadRequestException('La question ne peut pas être vide');
    }

    const doc = await this.consulterDocument(docId);

    if (doc.isArchived) {
      throw new ConflictException(
        'Le document est archivé et se trouve en lecture seule',
      );
    }

    // Ajout en commentaire
    const commentaire = this.commentaireRepository.create({
      documentId: docId,
      auteur: avocatName ? `Avocat (${avocatName})` : 'Avocat',
      texte: `[Demande d'informations] ${question}`,
      date: new Date(),
    });
    await this.commentaireRepository.save(commentaire);

    // Émettre événement
    this.eventEmitter.emit(
      DOCUMENT_EVENTS.INFO_REQUESTED,
      new DocumentInfoRequestedEvent(docId, question, avocatName),
    );

    this.logger.log(
      `Demande d'informations émise sur doc ${docId} par ${avocatName}`,
    );

    return this.consulterDocument(docId);
  }

  async signer(docId: string, avocatName: string): Promise<DocumentJuridique> {
    const doc = await this.consulterDocument(docId);

    if (doc.isArchived) {
      throw new ConflictException(
        'Le document est archivé et se trouve en lecture seule',
      );
    }

    // Machine à états : sign is only allowed from VALIDE
    if (doc.statut !== DocumentStatut.VALIDE) {
      throw new ConflictException(
        `Impossible de signer le document : la signature est uniquement autorisée depuis le statut '${DocumentStatut.VALIDE}' (statut actuel: '${doc.statut}')`,
      );
    }

    doc.statut = DocumentStatut.SIGNE;

    const saved = await this.documentRepository.save(doc);

    this.eventEmitter.emit(
      DOCUMENT_EVENTS.SIGNED,
      new DocumentSignedEvent(saved.id, avocatName),
    );

    this.eventEmitter.emit(
      DOCUMENT_EVENTS.STATUS_CHANGED,
      new DocumentStatusChangedEvent(
        saved.id,
        DocumentStatut.VALIDE,
        DocumentStatut.SIGNE,
        saved.projetId,
      ),
    );

    this.logger.log(
      `Document ${docId} signé avec succès par l'avocat (${avocatName})`,
    );
    return saved;
  }
}
