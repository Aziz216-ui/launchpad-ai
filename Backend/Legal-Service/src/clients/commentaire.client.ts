import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { appelDistant } from './appel-distant';
import { Commentaire } from './models/commentaire.model';

@Injectable()
export class CommentaireClient {
  private readonly baseUrl: string;

  constructor(
    private readonly http: HttpService,
    configService: ConfigService,
  ) {
    this.baseUrl = configService.get<string>(
      'COMMENTAIRE_SERVICE_URL',
      'http://localhost:3005/api/commentaires',
    );
  }

  findByDocument(documentId: string): Promise<Commentaire[]> {
    return appelDistant(
      'Commentaire-Service',
      this.http.get<Commentaire[]>(`${this.baseUrl}/documents/${documentId}`),
    );
  }

  creer(documentId: string, auteur: string, texte: string): Promise<Commentaire> {
    return appelDistant(
      'Commentaire-Service',
      this.http.post<Commentaire>(this.baseUrl, { documentId, auteur, texte }),
    );
  }
}
