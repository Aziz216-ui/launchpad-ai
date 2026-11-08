import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { WorkflowSignatureService } from './workflow-signature.service';
import { DocumentJuridique } from '../../database/entities/document-juridique.entity';
import { DocumentStatut } from '../../common/enums/document-statut.enum';
import { DOCUMENT_EVENTS } from '../../common/events/document.events';

describe('WorkflowSignatureService', () => {
  let service: WorkflowSignatureService;
  let mockDocRepo: any;
  let mockEventEmitter: any;

  beforeEach(async () => {
    mockDocRepo = {
      findOne: jest.fn(),
      save: jest.fn().mockImplementation((d) => Promise.resolve({ ...d })),
    };
    mockEventEmitter = {
      emit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkflowSignatureService,
        {
          provide: getRepositoryToken(DocumentJuridique),
          useValue: mockDocRepo,
        },
        {
          provide: EventEmitter2,
          useValue: mockEventEmitter,
        },
      ],
    }).compile();

    service = module.get<WorkflowSignatureService>(WorkflowSignatureService);
  });

  it('Demande la signature avec succès sur un document VALIDE', async () => {
    const doc = new DocumentJuridique();
    doc.id = 'doc-valide-1';
    doc.statut = DocumentStatut.VALIDE;
    doc.isArchived = false;
    doc.projetId = 'proj-1';
    mockDocRepo.findOne.mockResolvedValue(doc);

    const signataires = ['alice@startup.io', 'bob@startup.io'];
    const result = await service.demanderSignature(doc.id, signataires);

    expect(result.signataires).toEqual(signataires);
    expect(mockEventEmitter.emit).toHaveBeenCalledWith(
      DOCUMENT_EVENTS.SIGNATURE_REQUESTED,
      expect.anything(),
    );
  });

  it('Rejette la demande de signature si le document est en BROUILLON (409 Conflict)', async () => {
    const doc = new DocumentJuridique();
    doc.id = 'doc-brouillon-1';
    doc.statut = DocumentStatut.BROUILLON;
    doc.isArchived = false;
    mockDocRepo.findOne.mockResolvedValue(doc);

    await expect(
      service.demanderSignature(doc.id, ['test@startup.io']),
    ).rejects.toThrow(ConflictException);
  });

  it('Rejette la demande de signature si le document est archivé (409 Conflict)', async () => {
    const doc = new DocumentJuridique();
    doc.id = 'doc-archived';
    doc.statut = DocumentStatut.VALIDE;
    doc.isArchived = true;
    mockDocRepo.findOne.mockResolvedValue(doc);

    await expect(
      service.demanderSignature(doc.id, ['test@startup.io']),
    ).rejects.toThrow(ConflictException);
  });

  it('Retourne le statut de signature pour un document existant', async () => {
    const doc = new DocumentJuridique();
    doc.id = 'doc-sig-status';
    doc.statut = DocumentStatut.SIGNE;
    doc.signataires = ['alice@startup.io'];
    doc.version = 3;
    doc.updatedAt = new Date();
    mockDocRepo.findOne.mockResolvedValue(doc);

    const status = await service.getStatutSignature(doc.id);
    expect(status.isSigne).toBe(true);
    expect(status.statut).toBe(DocumentStatut.SIGNE);
    expect(status.signataires).toContain('alice@startup.io');
  });
});
