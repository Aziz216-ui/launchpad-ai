import { ServiceUnavailableException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { GenerateurJuridiqueService } from './generateur-juridique.service';
import { DocumentJuridique } from '../../database/entities/document-juridique.entity';
import { DocumentType } from '../../common/enums/document-type.enum';
import { DocumentStatut } from '../../common/enums/document-statut.enum';
import { ClauseClient } from '../../clients/clause.client';

describe('GenerateurJuridiqueService', () => {
  let service: GenerateurJuridiqueService;
  let mockDocRepo: any;
  let mockClauseClient: any;

  beforeEach(async () => {
    mockDocRepo = {
      create: jest.fn().mockImplementation((dto) => dto),
      save: jest.fn().mockImplementation((doc) =>
        Promise.resolve({
          ...doc,
          id: 'generated-doc-uuid',
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      ),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    mockClauseClient = {
      creerEnMasse: jest.fn().mockImplementation((documentId, clauses) =>
        Promise.resolve(
          clauses.map((c: any, i: number) => ({ ...c, id: `clause-${i}`, documentId })),
        ),
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GenerateurJuridiqueService,
        {
          provide: getRepositoryToken(DocumentJuridique),
          useValue: mockDocRepo,
        },
        {
          provide: ClauseClient,
          useValue: mockClauseClient,
        },
      ],
    }).compile();

    service = module.get<GenerateurJuridiqueService>(GenerateurJuridiqueService);
  });

  it('Génère des STATUTS en statut BROUILLON avec 7 clauses par défaut', async () => {
    const doc = await service.creerStatuts('proj-test', {
      denomination: 'InnovCorp SAS',
      capital: 50000,
    });

    expect(doc.type).toBe(DocumentType.STATUTS);
    expect(doc.statut).toBe(DocumentStatut.BROUILLON);
    expect(doc.version).toBe(1);
    expect(doc.clauses).toHaveLength(7);
    expect(doc.clauses[0].texte).toContain('InnovCorp SAS');
  });

  it('Génère un CONTRAT de prestation en statut BROUILLON avec ses clauses types', async () => {
    const doc = await service.creerContratPrestation('proj-test', {
      prestataire: 'DevAgency',
      client: 'Acme',
      montant: 12000,
    });

    expect(doc.type).toBe(DocumentType.CONTRAT);
    expect(doc.statut).toBe(DocumentStatut.BROUILLON);
    expect(doc.clauses.length).toBeGreaterThanOrEqual(5);
    expect(doc.clauses[0].texte).toContain('DevAgency');
  });

  it('Génère un accord NDA en statut BROUILLON', async () => {
    const doc = await service.creerNDA('proj-test', {
      partieA: 'Startup Alpha',
      partieB: 'Tech Partner',
      dureeMois: 36,
    });

    expect(doc.type).toBe(DocumentType.NDA);
    expect(doc.statut).toBe(DocumentStatut.BROUILLON);
    expect(doc.clauses).toHaveLength(5);
  });

  it('Génère un Procès-Verbal d’Assemblée en statut BROUILLON', async () => {
    const doc = await service.creerProcesVerbal('proj-test', {
      assembleeType: 'Générale Extraordinaire',
      president: 'Jean Dupont',
    });

    expect(doc.type).toBe(DocumentType.PV);
    expect(doc.statut).toBe(DocumentStatut.BROUILLON);
    expect(doc.clauses).toHaveLength(5);
  });

  it('Délègue la génération dynamique selon le type renseigné', async () => {
    const doc = await service.generer(DocumentType.NDA, 'proj-123', {});
    expect(doc.type).toBe(DocumentType.NDA);
  });

  it('Envoie les clauses au Clause-Service avec l’ID du document créé', async () => {
    await service.creerNDA('proj-test', {});

    expect(mockClauseClient.creerEnMasse).toHaveBeenCalledWith(
      'generated-doc-uuid',
      expect.arrayContaining([expect.objectContaining({ numero: 1 })]),
    );
  });

  it('Annule le document si le Clause-Service échoue (compensation)', async () => {
    mockClauseClient.creerEnMasse.mockRejectedValue(
      new ServiceUnavailableException('Clause-Service est indisponible'),
    );

    await expect(service.creerNDA('proj-test', {})).rejects.toThrow(
      ServiceUnavailableException,
    );
    expect(mockDocRepo.delete).toHaveBeenCalledWith('generated-doc-uuid');
  });
});
