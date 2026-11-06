import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocumentJuridique } from '../database/entities/document-juridique.entity';
import { ClientsModule } from '../clients/clients.module';
import { VerificationController } from './controllers/verification.controller';
import { VerificationAvocatService } from './services/verification-avocat.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([DocumentJuridique]),
    ClientsModule,
  ],
  controllers: [VerificationController],
  providers: [VerificationAvocatService],
  exports: [VerificationAvocatService],
})
export class VerificationModule {}
