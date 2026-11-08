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
import { DocumentStatut } from '../../common/enums/document-statut.enum';
import { ClauseClient } from '../../clients/clause.client';
import { CommentaireClient } from '../../clients/commentaire.client';
import { Clause } from '../../clients/models/clause.model';
import { Commentaire } from '../../clients/models/commentaire.model';
import { DocumentDetailDto } from '../../documents/dto/document-detail.dto';
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
    private readonly clauseClient: ClauseClient,
    private readonly commentaireClient: CommentaireClient,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // Document complet pour la revue : clauses et commentaires viennent des autres microservices
  async consulterDocument(id: string): Promise<DocumentDetailDto> {
    const doc = await this.trouverDocument(id);
    const [clauses, commentaires] = await Promise.all([
      this.clauseClient.findByDocument(id),
      this.commentaireClient.findByDocument(id),
    ]);
    return Object.assign(doc, { clauses, commentaires });
  }

  private async trouverDocument(id: string): Promise<DocumentJuridique> {
    const doc = await this.documentRepository.findOne({ where: { id } });

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
    const doc = await this.trouverDocument(docId);

    if (doc.isArchived) {
      throw new ConflictException(
        'Le document est archivé et se trouve en lecture seule',
      );
    }

    // Le Clause-Service renvoie 404 si la clause n'existe pas
    const savedClause = await this.clauseClient.modifier(docId, numero, {
      texte,
    });

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
    const doc = await this.trouverDocument(docId);

    if (doc.isArchived) {
      throw new ConflictException(
        'Le document est archivé et se trouve en lecture seule',
      );
    }

    const savedCommentaire = await this.commentaireClient.creer(
      docId,
      auteur || 'Avocat',
      texte,
    );
    this.logger.log(
      `Nouveau commentaire ajouté par ${auteur} sur le document ${docId}`,
    );
    return savedCommentaire;
  }

  async accepter(docId: string): Promise<DocumentJuridique> {
    const doc = await this.trouverDocument(docId);

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

    const doc = await this.trouverDocument(docId);

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
    await this.commentaireClient.creer(docId, 'Avocat (Motif de refus)', motif);

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
  ): Promise<DocumentDetailDto> {
    if (!question || question.trim() === '') {
      throw new BadRequestException('La question ne peut pas être vide');
    }

    const doc = await this.trouverDocument(docId);

    if (doc.isArchived) {
      throw new ConflictException(
        'Le document est archivé et se trouve en lecture seule',
      );
    }

    // Ajout en commentaire
    await this.commentaireClient.creer(
      docId,
      avocatName ? `Avocat (${avocatName})` : 'Avocat',
      `[Demande d'informations] ${question}`,
    );

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
    const doc = await this.trouverDocument(docId);

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
