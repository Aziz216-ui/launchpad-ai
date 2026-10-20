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
import PDFDocument = require('pdfkit');
import { DocumentJuridique } from '../../database/entities/document-juridique.entity';
import { Clause } from '../../database/entities/clause.entity';
import { Commentaire } from '../../database/entities/commentaire.entity';
import { DocumentStatut } from '../../common/enums/document-statut.enum';
import { ModifierDocumentDto } from '../dto/modifier-document.dto';
import { FilterDocumentsDto } from '../dto/filter-documents.dto';
import {
  DOCUMENT_EVENTS,
  DocumentArchivedEvent,
  DocumentStatusChangedEvent,
  DocumentValidationRequestedEvent,
} from '../../common/events/document.events';

@Injectable()
export class GestionnaireDocsJuridiquesService {
  private readonly logger = new Logger(GestionnaireDocsJuridiquesService.name);

  // Transitions autorisées selon la machine à états :
  // BROUILLON -> EN_VALIDATION -> VALIDE ou REFUSE; VALIDE -> SIGNE
  private readonly ALLOWED_TRANSITIONS: Record<DocumentStatut, DocumentStatut[]> = {
    [DocumentStatut.BROUILLON]: [DocumentStatut.EN_VALIDATION],
    [DocumentStatut.EN_VALIDATION]: [DocumentStatut.VALIDE, DocumentStatut.REFUSE],
    [DocumentStatut.VALIDE]: [DocumentStatut.SIGNE],
    [DocumentStatut.REFUSE]: [],
    [DocumentStatut.SIGNE]: [],
  };

  constructor(
    @InjectRepository(DocumentJuridique)
    private readonly documentRepository: Repository<DocumentJuridique>,
    @InjectRepository(Clause)
    private readonly clauseRepository: Repository<Clause>,
    @InjectRepository(Commentaire)
    private readonly commentaireRepository: Repository<Commentaire>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async list(filters?: FilterDocumentsDto): Promise<DocumentJuridique[]> {
    const query = this.documentRepository
      .createQueryBuilder('doc')
      .leftJoinAndSelect('doc.clauses', 'clause')
      .leftJoinAndSelect('doc.commentaires', 'commentaire')
      .orderBy('doc.createdAt', 'DESC')
      .addOrderBy('clause.numero', 'ASC')
      .addOrderBy('commentaire.date', 'ASC');

    if (filters?.projetId) {
      query.andWhere('doc.projetId = :projetId', { projetId: filters.projetId });
    }
    if (filters?.type) {
      query.andWhere('doc.type = :type', { type: filters.type });
    }
    if (filters?.statut) {
      query.andWhere('doc.statut = :statut', { statut: filters.statut });
    }

    return query.getMany();
  }

  async findById(id: string): Promise<DocumentJuridique> {
    const document = await this.documentRepository.findOne({
      where: { id },
      relations: ['clauses', 'commentaires'],
      order: {
        clauses: { numero: 'ASC' },
        commentaires: { date: 'ASC' },
      },
    });

    if (!document) {
      throw new NotFoundException(`Document juridique introuvable avec l'ID ${id}`);
    }

    return document;
  }

  async modifierDocument(
    id: string,
    modifs: ModifierDocumentDto,
  ): Promise<DocumentJuridique> {
    const doc = await this.findById(id);

    if (doc.isArchived) {
      throw new ConflictException(
        'Le document est archivé et se trouve en lecture seule',
      );
    }

    if (modifs.titre) {
      doc.titre = modifs.titre;
    }
    if (modifs.metadata) {
      doc.metadata = { ...(doc.metadata || {}), ...modifs.metadata };
    }

    // Incrémentation systématique de la version
    doc.version += 1;

    const saved = await this.documentRepository.save(doc);
    this.logger.log(`Document ${id} modifié -> Version ${saved.version}`);
    return saved;
  }

  async changerStatut(
    id: string,
    nouveauStatut: DocumentStatut,
    motif?: string,
  ): Promise<DocumentJuridique> {
    const doc = await this.findById(id);

    if (doc.isArchived) {
      throw new ConflictException(
        'Le document est archivé et se trouve en lecture seule',
      );
    }

    // Vérification de la transition d'état
    const autorisees = this.ALLOWED_TRANSITIONS[doc.statut] || [];
    if (!autorisees.includes(nouveauStatut)) {
      throw new ConflictException(
        `Transition de statut invalide : impossible de passer de '${doc.statut}' à '${nouveauStatut}'. Transitions autorisées depuis '${doc.statut}': [${autorisees.join(', ') || 'aucune'}]`,
      );
    }

    // Si rejet, le motif est obligatoire
    if (nouveauStatut === DocumentStatut.REFUSE && (!motif || motif.trim() === '')) {
      throw new BadRequestException('Le motif est obligatoire lors d’un refus');
    }

    const ancienStatut = doc.statut;
    doc.statut = nouveauStatut;
    if (motif) {
      doc.motifRefus = motif;
    }

    const saved = await this.documentRepository.save(doc);

    // Émission de l'événement de changement de statut
    this.eventEmitter.emit(
      DOCUMENT_EVENTS.STATUS_CHANGED,
      new DocumentStatusChangedEvent(
        saved.id,
        ancienStatut,
        nouveauStatut,
        saved.projetId,
        motif,
      ),
    );

    this.logger.log(
      `Statut document ${id} changé : ${ancienStatut} -> ${nouveauStatut}`,
    );

    return saved;
  }

  async archiver(id: string): Promise<DocumentJuridique> {
    const doc = await this.findById(id);

    if (doc.isArchived) {
      throw new ConflictException('Le document est déjà archivé');
    }

    doc.isArchived = true;
    doc.archivedAt = new Date();

    const saved = await this.documentRepository.save(doc);

    this.eventEmitter.emit(
      DOCUMENT_EVENTS.ARCHIVED,
      new DocumentArchivedEvent(saved.id, saved.projetId),
    );

    this.logger.log(`Document ${id} archivé (lecture seule)`);
    return saved;
  }

  async envoyerPourValidation(
    id: string,
    clientId: string,
  ): Promise<DocumentJuridique> {
    const doc = await this.findById(id);

    if (doc.isArchived) {
      throw new ConflictException(
        'Le document est archivé et se trouve en lecture seule',
      );
    }

    if (doc.statut !== DocumentStatut.BROUILLON) {
      throw new ConflictException(
        `Seul un document au statut BROUILLON peut être envoyé pour validation (statut actuel: ${doc.statut})`,
      );
    }

    doc.clientId = clientId;
    doc.statut = DocumentStatut.EN_VALIDATION;

    const saved = await this.documentRepository.save(doc);

    // Émettre l'événement requis
    this.eventEmitter.emit(
      DOCUMENT_EVENTS.VALIDATION_REQUESTED,
      new DocumentValidationRequestedEvent(
        saved.id,
        clientId,
        saved.projetId,
        saved.type,
      ),
    );

    this.eventEmitter.emit(
      DOCUMENT_EVENTS.STATUS_CHANGED,
      new DocumentStatusChangedEvent(
        saved.id,
        DocumentStatut.BROUILLON,
        DocumentStatut.EN_VALIDATION,
        saved.projetId,
      ),
    );

    this.logger.log(
      `Document ${id} envoyé pour validation par client ${clientId}`,
    );
    return saved;
  }

  async getClauses(id: string): Promise<Clause[]> {
    await this.findById(id); // vérifie existence
    return this.clauseRepository.find({
      where: { documentId: id },
      order: { numero: 'ASC' },
    });
  }

  async modifierClause(
    id: string,
    numero: number,
    texte: string,
    titre?: string,
  ): Promise<Clause> {
    const doc = await this.findById(id);

    if (doc.isArchived) {
      throw new ConflictException(
        'Le document est archivé et se trouve en lecture seule',
      );
    }

    const clause = await this.clauseRepository.findOne({
      where: { documentId: id, numero },
    });

    if (!clause) {
      throw new NotFoundException(
        `Clause n°${numero} introuvable pour le document ${id}`,
      );
    }

    clause.texte = texte;
    if (titre !== undefined) {
      clause.titre = titre;
    }

    const savedClause = await this.clauseRepository.save(clause);

    // Incrémentation systématique de la version du document
    doc.version += 1;
    await this.documentRepository.save(doc);

    this.logger.log(
      `Clause n°${numero} du document ${id} modifiée -> Doc Version ${doc.version}`,
    );
    return savedClause;
  }

  async getCommentaires(id: string): Promise<Commentaire[]> {
    await this.findById(id); // vérifie existence
    return this.commentaireRepository.find({
      where: { documentId: id },
      order: { date: 'ASC' },
    });
  }

  async exporterPDF(id: string): Promise<{ filename: string; buffer: Buffer }> {
    const doc = await this.findById(id);

    return new Promise<{ filename: string; buffer: Buffer }>((resolve, reject) => {
      try {
        const pdf = new PDFDocument({ margin: 50, size: 'A4' });
        const buffers: Buffer[] = [];

        pdf.on('data', (chunk: Buffer) => buffers.push(chunk));
        pdf.on('end', () => {
          const pdfBuffer = Buffer.concat(buffers);
          const safeTitle = doc.titre
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '-')
            .replace(/-+/g, '-');
          const filename = `${safeTitle}-v${doc.version}.pdf`;
          resolve({ filename, buffer: pdfBuffer });
        });
        pdf.on('error', (err: Error) => reject(err));

        // En-tête élégant LaunchPad Juridique
        pdf
          .fillColor('#1E293B')
          .fontSize(22)
          .text('LAUNCHPAD AI • DIRECTION JURIDIQUE', { align: 'center' });
        pdf.moveDown(0.5);

        pdf
          .strokeColor('#3B82F6')
          .lineWidth(2)
          .moveTo(50, pdf.y)
          .lineTo(545, pdf.y)
          .stroke();
        pdf.moveDown(1);

        // Titre du Document
        pdf
          .fillColor('#0F172A')
          .fontSize(18)
          .text(doc.titre, { align: 'center' });
        pdf.moveDown(1);

        // Bloc Métadonnées & Statut
        pdf
          .fillColor('#334155')
          .fontSize(10)
          .text(`ID Document : ${doc.id}`)
          .text(`Projet : ${doc.projetId}`)
          .text(`Type : ${doc.type} | Version : ${doc.version}`)
          .text(`Statut : ${doc.statut} ${doc.isArchived ? '(ARCHIVÉ)' : ''}`)
          .text(`Date de génération : ${doc.createdAt.toISOString()}`);
        pdf.moveDown(1.5);

        // Ligne de séparation
        pdf
          .strokeColor('#E2E8F0')
          .lineWidth(1)
          .moveTo(50, pdf.y)
          .lineTo(545, pdf.y)
          .stroke();
        pdf.moveDown(1.5);

        // Clauses juridiques
        pdf.fillColor('#0F172A').fontSize(14).text('CLAUSES CONTRACTUELLES', {
          underline: true,
        });
        pdf.moveDown(1);

        const clausesTriees = (doc.clauses || []).sort(
          (a, b) => a.numero - b.numero,
        );

        clausesTriees.forEach((clause) => {
          pdf
            .fillColor('#1E3A8A')
            .fontSize(12)
            .text(`Article ${clause.numero} : ${clause.titre || 'Dispositions'}`);
          pdf.moveDown(0.3);

          pdf
            .fillColor('#334155')
            .fontSize(10)
            .text(clause.texte, { align: 'justify', lineGap: 3 });
          pdf.moveDown(0.8);
        });

        // Signatures / Validation si validé ou signé
        pdf.moveDown(1.5);
        pdf
          .strokeColor('#E2E8F0')
          .lineWidth(1)
          .moveTo(50, pdf.y)
          .lineTo(545, pdf.y)
          .stroke();
        pdf.moveDown(1);

        pdf.fillColor('#0F172A').fontSize(11).text('MENTIONS ET SIGNATURES');
        pdf.moveDown(0.5);

        if (doc.signataires && doc.signataires.length > 0) {
          pdf
            .fillColor('#475569')
            .fontSize(9)
            .text(`Signataires requis : ${doc.signataires.join(', ')}`);
        }

        if (doc.statut === DocumentStatut.SIGNE) {
          pdf
            .fillColor('#15803D')
            .fontSize(10)
            .text('✔ DOCUMENT CERTIFIÉ CONFORME ET SIGNÉ ÉLECTRONIQUEMENT');
        } else if (doc.statut === DocumentStatut.VALIDE) {
          pdf
            .fillColor('#2563EB')
            .fontSize(10)
            .text('✔ DOCUMENT VALIDÉ PAR UN AVOCAT DU RÉSEAU LAUNCHPAD');
        }

        // Pied de page
        pdf.fontSize(8).fillColor('#94A3B8').text(
          `Généré automatiquement par LaunchPad Legal Service • Microservice v1.0`,
          50,
          780,
          { align: 'center', width: 500 },
        );

        pdf.end();
      } catch (error) {
        reject(error);
      }
    });
  }
}
