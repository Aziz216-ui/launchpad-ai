import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Commentaire } from '../../database/entities/commentaire.entity';
import { CreerCommentaireDto } from '../dto/creer-commentaire.dto';

@Injectable()
export class CommentairesService {
  private readonly logger = new Logger(CommentairesService.name);

  constructor(
    @InjectRepository(Commentaire)
    private readonly commentaireRepository: Repository<Commentaire>,
  ) {}

  async creer(dto: CreerCommentaireDto): Promise<Commentaire> {
    const commentaire = this.commentaireRepository.create({
      documentId: dto.documentId,
      auteur: dto.auteur || 'Avocat',
      texte: dto.texte,
    });

    const saved = await this.commentaireRepository.save(commentaire);
    this.logger.log(
      `Nouveau commentaire ajouté par ${saved.auteur} sur le document ${saved.documentId}`,
    );
    return saved;
  }

  async findByDocument(documentId: string): Promise<Commentaire[]> {
    return this.commentaireRepository.find({
      where: { documentId },
      order: { date: 'ASC' },
    });
  }

  async findById(id: string): Promise<Commentaire> {
    const commentaire = await this.commentaireRepository.findOne({
      where: { id },
    });

    if (!commentaire) {
      throw new NotFoundException(`Commentaire introuvable avec l'ID ${id}`);
    }

    return commentaire;
  }

  async supprimer(id: string): Promise<void> {
    const commentaire = await this.findById(id);
    await this.commentaireRepository.remove(commentaire);
    this.logger.log(`Commentaire ${id} supprimé`);
  }

  async supprimerParDocument(documentId: string): Promise<{ supprimes: number }> {
    const result = await this.commentaireRepository.delete({ documentId });
    const supprimes = result.affected ?? 0;
    this.logger.log(`${supprimes} commentaires supprimés pour le document ${documentId}`);
    return { supprimes };
  }
}
