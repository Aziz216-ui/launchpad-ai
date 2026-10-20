import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { GestionnaireDocsJuridiquesService } from './gestionnaire-docs-juridiques.service';
import { DocumentJuridique } from '../../database/entities/document-juridique.entity';
import { Clause } from '../../database/entities/clause.entity';
import { Commentaire } from '../../database/entities/commentaire.entity';
import { DocumentStatut } from '../../common/enums/document-statut.enum';
import { DocumentType } from '../../common/enums/document-type.enum';
import { DOCUMENT_EVENTS } from '../../common/events/document.events';

describe('GestionnaireDocsJuridiquesService (State Machine & Logic)', () => {
  let service: GestionnaireDocsJuridiquesService;
  let mockDocRepo: any;
  let mockClauseRepo: any;
  let mockCommRepo: any;
  let mockEventEmitter: any;

  const createMockDocument = (
    statut: DocumentStatut = DocumentStatut.BROUILLON,
    isArchived = false,
  ): DocumentJuridique => {
    const doc = new DocumentJuridique();
    doc.id = 'doc-uuid-1234';
    doc.projetId = 'proj-999';
    doc.type = DocumentType.STATUTS;
    doc.titre = 'Statuts Test';
    doc.statut = statut;
    doc.version = 1;
    doc.isArchived = isArchived;
    doc.metadata = {};
    doc.clauses = [];
    doc.commentaires = [];
    doc.createdAt = new Date();
    doc.updatedAt = new Date();
    return doc;
  };

  beforeEach(async () => {
    mockDocRepo = {
      findOne: jest.fn(),
      save: jest.fn().mockImplementation((doc) => Promise.resolve({ ...doc })),
      createQueryBuilder: jest.fn(),
    };
    mockClauseRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn().mockImplementation((c) => Promise.resolve({ ...c })),
    };
    mockCommRepo = {
      find: jest.fn(),
      save: jest.fn().mockImplementation((c) => Promise.resolve({ ...c })),
    };
    mockEventEmitter = {
      emit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GestionnaireDocsJuridiquesService,
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

    service = module.get<GestionnaireDocsJuridiquesService>(
      GestionnaireDocsJuridiquesService,
    );
  });

  describe('Machine à états (Status state machine)', () => {
    it('Autorise la transition valide : BROUILLON -> EN_VALIDATION', async () => {
      const doc = createMockDocument(DocumentStatut.BROUILLON);
      mockDocRepo.findOne.mockResolvedValue(doc);

      const result = await service.changerStatut(
        doc.id,
        DocumentStatut.EN_VALIDATION,
      );

      expect(result.statut).toBe(DocumentStatut.EN_VALIDATION);
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        DOCUMENT_EVENTS.STATUS_CHANGED,
        expect.objectContaining({
          previousStatut: DocumentStatut.BROUILLON,
          nouveauStatut: DocumentStatut.EN_VALIDATION,
        }),
      );
    });

    it('Refuse la transition invalide directe : BROUILLON -> VALIDE (409 Conflict)', async () => {
      const doc = createMockDocument(DocumentStatut.BROUILLON);
      mockDocRepo.findOne.mockResolvedValue(doc);

      await expect(
        service.changerStatut(doc.id, DocumentStatut.VALIDE),
      ).rejects.toThrow(ConflictException);
    });

    it('Refuse la transition invalide directe : BROUILLON -> SIGNE (409 Conflict)', async () => {
      const doc = createMockDocument(DocumentStatut.BROUILLON);
      mockDocRepo.findOne.mockResolvedValue(doc);

      await expect(
        service.changerStatut(doc.id, DocumentStatut.SIGNE),
      ).rejects.toThrow(ConflictException);
    });

    it('Autorise la transition valide : EN_VALIDATION -> VALIDE', async () => {
      const doc = createMockDocument(DocumentStatut.EN_VALIDATION);
      mockDocRepo.findOne.mockResolvedValue(doc);

      const result = await service.changerStatut(doc.id, DocumentStatut.VALIDE);
      expect(result.statut).toBe(DocumentStatut.VALIDE);
    });

    it('Autorise la transition valide : EN_VALIDATION -> REFUSE avec motif', async () => {
      const doc = createMockDocument(DocumentStatut.EN_VALIDATION);
      mockDocRepo.findOne.mockResolvedValue(doc);

      const result = await service.changerStatut(
        doc.id,
        DocumentStatut.REFUSE,
        'Objet social incomplet',
      );
      expect(result.statut).toBe(DocumentStatut.REFUSE);
      expect(result.motifRefus).toBe('Objet social incomplet');
    });

    it('Rejette la transition EN_VALIDATION -> REFUSE si motif absent (400 Bad Request)', async () => {
      const doc = createMockDocument(DocumentStatut.EN_VALIDATION);
      mockDocRepo.findOne.mockResolvedValue(doc);

      await expect(
        service.changerStatut(doc.id, DocumentStatut.REFUSE),
      ).rejects.toThrow(BadRequestException);
    });

    it('Refuse la transition invalide directe : EN_VALIDATION -> SIGNE (409 Conflict)', async () => {
      const doc = createMockDocument(DocumentStatut.EN_VALIDATION);
      mockDocRepo.findOne.mockResolvedValue(doc);

      await expect(
        service.changerStatut(doc.id, DocumentStatut.SIGNE),
      ).rejects.toThrow(ConflictException);
    });

    it('Autorise la transition valide : VALIDE -> SIGNE', async () => {
      const doc = createMockDocument(DocumentStatut.VALIDE);
      mockDocRepo.findOne.mockResolvedValue(doc);

      const result = await service.changerStatut(doc.id, DocumentStatut.SIGNE);
      expect(result.statut).toBe(DocumentStatut.SIGNE);
    });

    it('Interdit toute transition depuis l’état SIGNE (terminal)', async () => {
      const doc = createMockDocument(DocumentStatut.SIGNE);
      mockDocRepo.findOne.mockResolvedValue(doc);

      await expect(
        service.changerStatut(doc.id, DocumentStatut.VALIDE),
      ).rejects.toThrow(ConflictException);
      await expect(
        service.changerStatut(doc.id, DocumentStatut.BROUILLON),
      ).rejects.toThrow(ConflictException);
    });

    it('Interdit toute transition depuis l’état REFUSE (terminal)', async () => {
      const doc = createMockDocument(DocumentStatut.REFUSE);
      mockDocRepo.findOne.mockResolvedValue(doc);

      await expect(
        service.changerStatut(doc.id, DocumentStatut.VALIDE),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('Règle d’archivage (Lecture seule)', () => {
    it('Interdit la modification d’un document archivé', async () => {
      const doc = createMockDocument(DocumentStatut.BROUILLON, true);
      mockDocRepo.findOne.mockResolvedValue(doc);

      await expect(
        service.modifierDocument(doc.id, { titre: 'Nouveau titre' }),
      ).rejects.toThrow(ConflictException);
    });

    it('Interdit le changement de statut d’un document archivé', async () => {
      const doc = createMockDocument(DocumentStatut.BROUILLON, true);
      mockDocRepo.findOne.mockResolvedValue(doc);

      await expect(
        service.changerStatut(doc.id, DocumentStatut.EN_VALIDATION),
      ).rejects.toThrow(ConflictException);
    });

    it('Archive avec succès un document non archivé', async () => {
      const doc = createMockDocument(DocumentStatut.VALIDE, false);
      mockDocRepo.findOne.mockResolvedValue(doc);

      const result = await service.archiver(doc.id);
      expect(result.isArchived).toBe(true);
      expect(result.archivedAt).toBeDefined();
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        DOCUMENT_EVENTS.ARCHIVED,
        expect.anything(),
      );
    });
  });

  describe('Incrémentation de version', () => {
    it('Incrémente la version du document lors d’une modification', async () => {
      const doc = createMockDocument(DocumentStatut.BROUILLON);
      doc.version = 1;
      mockDocRepo.findOne.mockResolvedValue(doc);

      const result = await service.modifierDocument(doc.id, {
        titre: 'Statuts Modifiés',
      });
      expect(result.version).toBe(2);
      expect(result.titre).toBe('Statuts Modifiés');
    });

    it('Incrémente la version du document lors de la modification d’une clause', async () => {
      const doc = createMockDocument(DocumentStatut.BROUILLON);
      doc.version = 2;
      mockDocRepo.findOne.mockResolvedValue(doc);

      const clause = new Clause();
      clause.id = 'clause-1';
      clause.numero = 1;
      clause.texte = 'Texte initial';
      clause.documentId = doc.id;
      mockClauseRepo.findOne.mockResolvedValue(clause);

      const updatedClause = await service.modifierClause(
        doc.id,
        1,
        'Nouveau texte de la clause',
      );
      expect(updatedClause.texte).toBe('Nouveau texte de la clause');
      expect(doc.version).toBe(3);
      expect(mockDocRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ version: 3 }),
      );
    });
  });

  describe('Envoyer pour validation (envoyerPourValidation)', () => {
    it('Passe le document de BROUILLON à EN_VALIDATION et émet document.validation.requested', async () => {
      const doc = createMockDocument(DocumentStatut.BROUILLON);
      mockDocRepo.findOne.mockResolvedValue(doc);

      const result = await service.envoyerPourValidation(doc.id, 'client-45');
      expect(result.statut).toBe(DocumentStatut.EN_VALIDATION);
      expect(result.clientId).toBe('client-45');
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        DOCUMENT_EVENTS.VALIDATION_REQUESTED,
        expect.objectContaining({
          documentId: doc.id,
          clientId: 'client-45',
        }),
      );
    });

    it('Refuse d’envoyer pour validation un document qui n’est pas au statut BROUILLON', async () => {
      const doc = createMockDocument(DocumentStatut.VALIDE);
      mockDocRepo.findOne.mockResolvedValue(doc);

      await expect(
        service.envoyerPourValidation(doc.id, 'client-45'),
      ).rejects.toThrow(ConflictException);
    });
  });
});
