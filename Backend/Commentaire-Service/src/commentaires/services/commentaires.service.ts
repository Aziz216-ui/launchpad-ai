import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Commentaire } from '../../database/entities/commentaire.entity';
import { CreerCommentaireDto } from '../dto/creer-commentaire.dto';
import { RabbitMQService } from '../../messaging/rabbitmq.service';
import {
  COMMENTAIRE_EVENTS,
  CommentaireCreatedEvent,
  CommentairesDeletedEvent,
} from '../../common/events/commentaire.events';

@Injectable()
export class CommentairesService {
  private readonly logger = new Logger(CommentairesService.name);

  constructor(
    @InjectRepository(Commentaire)
    private readonly commentaireRepository: Repository<Commentaire>,
    private readonly rabbitMQService: RabbitMQService,
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
    this.rabbitMQService.publish(COMMENTAIRE_EVENTS.CREATED, {
      commentaireId: saved.id,
      documentId: saved.documentId,
      auteur: saved.auteur,
      timestamp: new Date(),
    } satisfies CommentaireCreatedEvent);
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
    this.rabbitMQService.publish(COMMENTAIRE_EVENTS.DELETED, {
      documentId: commentaire.documentId,
      commentaireId: id,
      supprimes: 1,
      timestamp: new Date(),
    } satisfies CommentairesDeletedEvent);
  }

  async supprimerParDocument(documentId: string): Promise<{ supprimes: number }> {
    const result = await this.commentaireRepository.delete({ documentId });
    const supprimes = result.affected ?? 0;
    this.logger.log(`${supprimes} commentaires supprimés pour le document ${documentId}`);
    this.rabbitMQService.publish(COMMENTAIRE_EVENTS.DELETED, {
      documentId,
      supprimes,
      timestamp: new Date(),
    } satisfies CommentairesDeletedEvent);
    return { supprimes };
  }
}
