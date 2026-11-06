import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { appelDistant } from './appel-distant';
import { Clause, ClauseContenu } from './models/clause.model';

@Injectable()
export class ClauseClient {
  private readonly baseUrl: string;

  constructor(
    private readonly http: HttpService,
    configService: ConfigService,
  ) {
    this.baseUrl = configService.get<string>(
      'CLAUSE_SERVICE_URL',
      'http://localhost:3004/api/clauses',
    );
  }

  findByDocument(documentId: string): Promise<Clause[]> {
    return appelDistant(
      'Clause-Service',
      this.http.get<Clause[]>(`${this.baseUrl}/documents/${documentId}`),
    );
  }

  creerEnMasse(documentId: string, clauses: ClauseContenu[]): Promise<Clause[]> {
    return appelDistant(
      'Clause-Service',
      this.http.post<Clause[]>(`${this.baseUrl}/bulk`, { documentId, clauses }),
    );
  }

  modifier(
    documentId: string,
    numero: number,
    modifs: { texte: string; titre?: string },
  ): Promise<Clause> {
    return appelDistant(
      'Clause-Service',
      this.http.patch<Clause>(
        `${this.baseUrl}/documents/${documentId}/${numero}`,
        modifs,
      ),
    );
  }

  supprimerParDocument(documentId: string): Promise<{ supprimees: number }> {
    return appelDistant(
      'Clause-Service',
      this.http.delete<{ supprimees: number }>(
        `${this.baseUrl}/documents/${documentId}`,
      ),
    );
  }
}
