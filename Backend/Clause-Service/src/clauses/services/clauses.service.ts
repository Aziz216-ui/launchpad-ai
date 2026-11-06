import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Clause } from '../../database/entities/clause.entity';
import { CreerClauseDto } from '../dto/creer-clause.dto';
import { CreerClausesDto } from '../dto/creer-clauses.dto';
import { ModifierClauseDto } from '../dto/modifier-clause.dto';

@Injectable()
export class ClausesService {
  private readonly logger = new Logger(ClausesService.name);

  constructor(
    @InjectRepository(Clause)
    private readonly clauseRepository: Repository<Clause>,
  ) {}

  async creer(dto: CreerClauseDto): Promise<Clause> {
    const existante = await this.clauseRepository.findOne({
      where: { documentId: dto.documentId, numero: dto.numero },
    });
    if (existante) {
      throw new ConflictException(
        `La clause n°${dto.numero} existe déjà pour le document ${dto.documentId}`,
      );
    }

    const saved = await this.clauseRepository.save(
      this.clauseRepository.create(dto),
    );
    this.logger.log(`Clause n°${saved.numero} créée pour le document ${saved.documentId}`);
    return saved;
  }

  async creerEnMasse(dto: CreerClausesDto): Promise<Clause[]> {
    const clauses = dto.clauses.map((c) =>
      this.clauseRepository.create({ ...c, documentId: dto.documentId }),
    );

    const saved = await this.clauseRepository.save(clauses);
    this.logger.log(`${saved.length} clauses créées pour le document ${dto.documentId}`);
    return saved.sort((a, b) => a.numero - b.numero);
  }

  async findByDocument(documentId: string): Promise<Clause[]> {
    return this.clauseRepository.find({
      where: { documentId },
      order: { numero: 'ASC' },
    });
  }

  async findOne(documentId: string, numero: number): Promise<Clause> {
    const clause = await this.clauseRepository.findOne({
      where: { documentId, numero },
    });

    if (!clause) {
      throw new NotFoundException(
        `Clause n°${numero} introuvable pour le document ${documentId}`,
      );
    }

    return clause;
  }

  async modifier(
    documentId: string,
    numero: number,
    dto: ModifierClauseDto,
  ): Promise<Clause> {
    const clause = await this.findOne(documentId, numero);

    clause.texte = dto.texte;
    if (dto.titre !== undefined) {
      clause.titre = dto.titre;
    }

    const saved = await this.clauseRepository.save(clause);
    this.logger.log(`Clause n°${numero} du document ${documentId} modifiée`);
    return saved;
  }

  async supprimerParDocument(documentId: string): Promise<{ supprimees: number }> {
    const result = await this.clauseRepository.delete({ documentId });
    const supprimees = result.affected ?? 0;
    this.logger.log(`${supprimees} clauses supprimées pour le document ${documentId}`);
    return { supprimees };
  }
}
