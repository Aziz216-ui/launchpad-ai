<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Schéma initial du service comptable.
 */
final class Version20261019221144 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Schéma initial : espaces, dossiers, affectations, documents, validations, événements, messages';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('CREATE TABLE accountant_workspace (id BINARY(16) NOT NULL, accountant_id VARCHAR(64) NOT NULL, display_name VARCHAR(150) NOT NULL, accepting_clients TINYINT NOT NULL, active TINYINT NOT NULL, created_at DATETIME NOT NULL, updated_at DATETIME NOT NULL, UNIQUE INDEX UNIQ_B38866A39582AA74 (accountant_id), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4');
        $this->addSql('CREATE TABLE accounting_document (id BINARY(16) NOT NULL, title VARCHAR(200) NOT NULL, type VARCHAR(30) NOT NULL, source VARCHAR(10) NOT NULL, storage_key VARCHAR(255) DEFAULT NULL, original_filename VARCHAR(255) DEFAULT NULL, mime_type VARCHAR(100) DEFAULT NULL, size INT DEFAULT NULL, checksum VARCHAR(64) DEFAULT NULL, external_ref VARCHAR(255) DEFAULT NULL, external_service VARCHAR(50) DEFAULT NULL, period_start DATE DEFAULT NULL, period_end DATE DEFAULT NULL, status VARCHAR(20) NOT NULL, version_number SMALLINT NOT NULL, uploaded_by VARCHAR(64) NOT NULL, uploaded_by_role VARCHAR(20) NOT NULL, uploaded_at DATETIME NOT NULL, updated_at DATETIME NOT NULL, deleted_at DATETIME DEFAULT NULL, client_file_id BINARY(16) NOT NULL, previous_version_id BINARY(16) DEFAULT NULL, INDEX idx_document_status (status), INDEX IDX_60EDA784C1F63D11 (client_file_id), INDEX IDX_60EDA7843CBC65BC (previous_version_id), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4');
        $this->addSql('CREATE TABLE client_file (id BINARY(16) NOT NULL, reference VARCHAR(20) NOT NULL, entrepreneur_id VARCHAR(64) NOT NULL, entrepreneur_display_name VARCHAR(150) DEFAULT NULL, startup_id VARCHAR(64) DEFAULT NULL, startup_name VARCHAR(150) NOT NULL, request_message LONGTEXT DEFAULT NULL, status VARCHAR(20) NOT NULL, rejection_reason LONGTEXT DEFAULT NULL, decided_at DATETIME DEFAULT NULL, closed_at DATETIME DEFAULT NULL, created_at DATETIME NOT NULL, updated_at DATETIME NOT NULL, workspace_id BINARY(16) NOT NULL, UNIQUE INDEX UNIQ_5D03F572AEA34913 (reference), INDEX idx_client_file_entrepreneur (entrepreneur_id), INDEX idx_client_file_status (status), INDEX IDX_5D03F57282D40A1F (workspace_id), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4');
        $this->addSql('CREATE TABLE client_file_assignment (id BINARY(16) NOT NULL, type VARCHAR(30) NOT NULL, previous_accountant_id VARCHAR(64) DEFAULT NULL, new_accountant_id VARCHAR(64) NOT NULL, assigned_by VARCHAR(64) NOT NULL, reason LONGTEXT DEFAULT NULL, assigned_at DATETIME NOT NULL, client_file_id BINARY(16) NOT NULL, INDEX IDX_F40BC2FFC1F63D11 (client_file_id), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4');
        $this->addSql('CREATE TABLE document_event (id BINARY(16) NOT NULL, type VARCHAR(30) NOT NULL, actor_id VARCHAR(64) NOT NULL, actor_role VARCHAR(20) NOT NULL, comment LONGTEXT DEFAULT NULL, created_at DATETIME NOT NULL, document_id BINARY(16) NOT NULL, INDEX IDX_520F7CD5C33F7837 (document_id), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4');
        $this->addSql('CREATE TABLE message (id BINARY(16) NOT NULL, sender_id VARCHAR(64) NOT NULL, sender_role VARCHAR(20) NOT NULL, content LONGTEXT NOT NULL, read_at DATETIME DEFAULT NULL, created_at DATETIME NOT NULL, client_file_id BINARY(16) NOT NULL, document_id BINARY(16) DEFAULT NULL, INDEX IDX_B6BD307FC1F63D11 (client_file_id), INDEX IDX_B6BD307FC33F7837 (document_id), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4');
        $this->addSql('CREATE TABLE validation (id BINARY(16) NOT NULL, accountant_id VARCHAR(64) NOT NULL, decision VARCHAR(20) NOT NULL, previous_status VARCHAR(20) NOT NULL, comment LONGTEXT DEFAULT NULL, automatic TINYINT NOT NULL, created_at DATETIME NOT NULL, document_id BINARY(16) NOT NULL, INDEX IDX_16AC5B6EC33F7837 (document_id), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4');
        $this->addSql('ALTER TABLE accounting_document ADD CONSTRAINT FK_60EDA784C1F63D11 FOREIGN KEY (client_file_id) REFERENCES client_file (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE accounting_document ADD CONSTRAINT FK_60EDA7843CBC65BC FOREIGN KEY (previous_version_id) REFERENCES accounting_document (id)');
        $this->addSql('ALTER TABLE client_file ADD CONSTRAINT FK_5D03F57282D40A1F FOREIGN KEY (workspace_id) REFERENCES accountant_workspace (id)');
        $this->addSql('ALTER TABLE client_file_assignment ADD CONSTRAINT FK_F40BC2FFC1F63D11 FOREIGN KEY (client_file_id) REFERENCES client_file (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE document_event ADD CONSTRAINT FK_520F7CD5C33F7837 FOREIGN KEY (document_id) REFERENCES accounting_document (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE message ADD CONSTRAINT FK_B6BD307FC1F63D11 FOREIGN KEY (client_file_id) REFERENCES client_file (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE message ADD CONSTRAINT FK_B6BD307FC33F7837 FOREIGN KEY (document_id) REFERENCES accounting_document (id) ON DELETE SET NULL');
        $this->addSql('ALTER TABLE validation ADD CONSTRAINT FK_16AC5B6EC33F7837 FOREIGN KEY (document_id) REFERENCES accounting_document (id) ON DELETE CASCADE');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE accounting_document DROP FOREIGN KEY FK_60EDA784C1F63D11');
        $this->addSql('ALTER TABLE accounting_document DROP FOREIGN KEY FK_60EDA7843CBC65BC');
        $this->addSql('ALTER TABLE client_file DROP FOREIGN KEY FK_5D03F57282D40A1F');
        $this->addSql('ALTER TABLE client_file_assignment DROP FOREIGN KEY FK_F40BC2FFC1F63D11');
        $this->addSql('ALTER TABLE document_event DROP FOREIGN KEY FK_520F7CD5C33F7837');
        $this->addSql('ALTER TABLE message DROP FOREIGN KEY FK_B6BD307FC1F63D11');
        $this->addSql('ALTER TABLE message DROP FOREIGN KEY FK_B6BD307FC33F7837');
        $this->addSql('ALTER TABLE validation DROP FOREIGN KEY FK_16AC5B6EC33F7837');
        $this->addSql('DROP TABLE accountant_workspace');
        $this->addSql('DROP TABLE accounting_document');
        $this->addSql('DROP TABLE client_file');
        $this->addSql('DROP TABLE client_file_assignment');
        $this->addSql('DROP TABLE document_event');
        $this->addSql('DROP TABLE message');
        $this->addSql('DROP TABLE validation');
    }
}
