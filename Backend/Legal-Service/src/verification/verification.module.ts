import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocumentJuridique } from '../database/entities/document-juridique.entity';
import { Clause } from '../database/entities/clause.entity';
import { Commentaire } from '../database/entities/commentaire.entity';
import { VerificationController } from './controllers/verification.controller';
import { VerificationAvocatService } from './services/verification-avocat.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([DocumentJuridique, Clause, Commentaire]),
  ],
  controllers: [VerificationController],
  providers: [VerificationAvocatService],
  exports: [VerificationAvocatService],
})
export class VerificationModule {}
