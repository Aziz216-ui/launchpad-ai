import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { VerificationAvocatService } from './verification-avocat.service';
import { DocumentJuridique } from '../../database/entities/document-juridique.entity';
import { Clause } from '../../database/entities/clause.entity';
import { Commentaire } from '../../database/entities/commentaire.entity';
import { DocumentStatut } from '../../common/enums/document-statut.enum';
import { DocumentType } from '../../common/enums/document-type.enum';
import { DOCUMENT_EVENTS } from '../../common/events/document.events';

describe('VerificationAvocatService', () => {
  let service: VerificationAvocatService;
  let mockDocRepo: any;
  let mockClauseRepo: any;
  let mockCommRepo: any;
  let mockEventEmitter: any;

  const createDoc = (statut: DocumentStatut, isArchived = false) => {
    const doc = new DocumentJuridique();
    doc.id = 'doc-rev-1';
    doc.projetId = 'proj-rev';
    doc.type = DocumentType.CONTRAT;
    doc.statut = statut;
    doc.version = 1;
    doc.isArchived = isArchived;
    doc.clauses = [];
    doc.commentaires = [];
    return doc;
  };

  beforeEach(async () => {
    mockDocRepo = {
      findOne: jest.fn(),
      save: jest.fn().mockImplementation((d) => Promise.resolve({ ...d })),
    };
    mockClauseRepo = {
      findOne: jest.fn(),
      save: jest.fn().mockImplementation((c) => Promise.resolve({ ...c })),
    };
    mockCommRepo = {
      create: jest.fn().mockImplementation((c) => c),
      save: jest.fn().mockImplementation((c) => Promise.resolve({ ...c, id: 'comm-1' })),
    };
    mockEventEmitter = {
      emit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VerificationAvocatService,
        {
          provide: getRepositoryToken(DocumentJuridique),
          useValue: mockDocRepo,
        },
        {
          provide: getRepositoryToken(Clause),
          useValue: mockClauseRepo,
        },
        {
          provide: getRepositoryToken(Commentaire),
          useValue: mockCommRepo,
        },
        {
          provide: EventEmitter2,
          useValue: mockEventEmitter,
        },
      ],
    }).compile();

    service = module.get<VerificationAvocatService>(VerificationAvocatService);
  });

  describe('Accepter (accepter)', () => {
    it('Valide le document si le statut est EN_VALIDATION', async () => {
      const doc = createDoc(DocumentStatut.EN_VALIDATION);
      mockDocRepo.findOne.mockResolvedValue(doc);

      const result = await service.accepter(doc.id);
      expect(result.statut).toBe(DocumentStatut.VALIDE);
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        DOCUMENT_EVENTS.STATUS_CHANGED,
        expect.anything(),
      );
    });

    it('Refuse la validation si le document est encore en BROUILLON (409 Conflict)', async () => {
      const doc = createDoc(DocumentStatut.BROUILLON);
      mockDocRepo.findOne.mockResolvedValue(doc);

      await expect(service.accepter(doc.id)).rejects.toThrow(ConflictException);
    });
  });

  describe('Refuser (refuser)', () => {
    it('Refuse le document et enregistre le motif', async () => {
      const doc = createDoc(DocumentStatut.EN_VALIDATION);
      mockDocRepo.findOne.mockResolvedValue(doc);

      const result = await service.refuser(doc.id, 'Pénalités non conformes');
      expect(result.statut).toBe(DocumentStatut.REFUSE);
      expect(result.motifRefus).toBe('Pénalités non conformes');
      expect(mockCommRepo.save).toHaveBeenCalled();
    });

    it('Lève une exception si le motif est vide', async () => {
      const doc = createDoc(DocumentStatut.EN_VALIDATION);
      mockDocRepo.findOne.mockResolvedValue(doc);

      await expect(service.refuser(doc.id, '')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('Refuse le rejet si le document n’est pas en EN_VALIDATION (409 Conflict)', async () => {
      const doc = createDoc(DocumentStatut.BROUILLON);
      mockDocRepo.findOne.mockResolvedValue(doc);

      await expect(
        service.refuser(doc.id, 'Raison quelconque'),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('Demande d’informations (demanderInformations)', () => {
    it('Enregistre un commentaire et émet l’événement document.info.requested', async () => {
      const doc = createDoc(DocumentStatut.EN_VALIDATION);
      mockDocRepo.findOne.mockResolvedValue(doc);

      const result = await service.demanderInformations(
        doc.id,
        'Quel est le régime fiscal choisi ?',
        'Me Laurent Dupont',
      );

      expect(mockCommRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          texte: "[Demande d'informations] Quel est le régime fiscal choisi ?",
        }),
      );
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        DOCUMENT_EVENTS.INFO_REQUESTED,
        expect.anything(),
      );
      expect(result).toBeDefined();
    });
  });

  describe('Signer (signer)', () => {
    it('Autorise la signature uniquement depuis le statut VALIDE', async () => {
      const doc = createDoc(DocumentStatut.VALIDE);
      mockDocRepo.findOne.mockResolvedValue(doc);

      const result = await service.signer(doc.id, 'Me Laurent Dupont');
      expect(result.statut).toBe(DocumentStatut.SIGNE);
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        DOCUMENT_EVENTS.SIGNED,
        expect.anything(),
      );
    });

    it('Interdit la signature depuis le statut EN_VALIDATION (409 Conflict)', async () => {
      const doc = createDoc(DocumentStatut.EN_VALIDATION);
      mockDocRepo.findOne.mockResolvedValue(doc);

      await expect(
        service.signer(doc.id, 'Me Laurent Dupont'),
      ).rejects.toThrow(ConflictException);
    });

    it('Interdit la signature depuis le statut BROUILLON (409 Conflict)', async () => {
      const doc = createDoc(DocumentStatut.BROUILLON);
      mockDocRepo.findOne.mockResolvedValue(doc);

      await expect(
        service.signer(doc.id, 'Me Laurent Dupont'),
      ).rejects.toThrow(ConflictException);
    });
  });
});
