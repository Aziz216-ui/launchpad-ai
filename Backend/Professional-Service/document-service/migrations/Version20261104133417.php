<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Auto-generated Migration: Please modify to your needs!
 */
final class Version20261104133417 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'document-service : documents comptables, validations et événements';
    }

    public function up(Schema $schema): void
    {
        // this up() migration is auto-generated, please modify it to your needs
        $this->addSql(<<<'SQL'
            CREATE TABLE accounting_document (
              id BINARY(16) NOT NULL,
              client_file_id BINARY(16) NOT NULL,
              title VARCHAR(200) NOT NULL,
              type VARCHAR(30) NOT NULL,
              source VARCHAR(10) NOT NULL,
              storage_key VARCHAR(255) DEFAULT NULL,
              original_filename VARCHAR(255) DEFAULT NULL,
              mime_type VARCHAR(100) DEFAULT NULL,
              size INT DEFAULT NULL,
              checksum VARCHAR(64) DEFAULT NULL,
              external_ref VARCHAR(255) DEFAULT NULL,
              external_service VARCHAR(50) DEFAULT NULL,
              period_start DATE DEFAULT NULL,
              period_end DATE DEFAULT NULL,
              status VARCHAR(20) NOT NULL,
              version_number SMALLINT NOT NULL,
              uploaded_by VARCHAR(64) NOT NULL,
              uploaded_by_role VARCHAR(20) NOT NULL,
              uploaded_at DATETIME NOT NULL,
              updated_at DATETIME NOT NULL,
              deleted_at DATETIME DEFAULT NULL,
              previous_version_id BINARY(16) DEFAULT NULL,
              INDEX idx_document_status (status),
              INDEX idx_document_client_file (client_file_id),
              INDEX IDX_60EDA7843CBC65BC (previous_version_id),
              PRIMARY KEY (id)
            ) DEFAULT CHARACTER SET utf8mb4
        SQL);
        $this->addSql(<<<'SQL'
            CREATE TABLE document_event (
              id BINARY(16) NOT NULL,
              type VARCHAR(30) NOT NULL,
              actor_id VARCHAR(64) NOT NULL,
              actor_role VARCHAR(20) NOT NULL,
              comment LONGTEXT DEFAULT NULL,
              created_at DATETIME NOT NULL,
              document_id BINARY(16) NOT NULL,
              INDEX IDX_520F7CD5C33F7837 (document_id),
              PRIMARY KEY (id)
            ) DEFAULT CHARACTER SET utf8mb4
        SQL);
        $this->addSql(<<<'SQL'
            CREATE TABLE validation (
              id BINARY(16) NOT NULL,
              accountant_id VARCHAR(64) NOT NULL,
              decision VARCHAR(20) NOT NULL,
              previous_status VARCHAR(20) NOT NULL,
              comment LONGTEXT DEFAULT NULL,
              automatic TINYINT NOT NULL,
              created_at DATETIME NOT NULL,
              document_id BINARY(16) NOT NULL,
              INDEX IDX_16AC5B6EC33F7837 (document_id),
              PRIMARY KEY (id)
            ) DEFAULT CHARACTER SET utf8mb4
        SQL);
        $this->addSql(<<<'SQL'
            ALTER TABLE
              accounting_document
            ADD
              CONSTRAINT FK_60EDA7843CBC65BC FOREIGN KEY (previous_version_id) REFERENCES accounting_document (id) ON DELETE SET NULL
        SQL);
        $this->addSql(<<<'SQL'
            ALTER TABLE
              document_event
            ADD
              CONSTRAINT FK_520F7CD5C33F7837 FOREIGN KEY (document_id) REFERENCES accounting_document (id) ON DELETE CASCADE
        SQL);
        $this->addSql(<<<'SQL'
            ALTER TABLE
              validation
            ADD
              CONSTRAINT FK_16AC5B6EC33F7837 FOREIGN KEY (document_id) REFERENCES accounting_document (id) ON DELETE CASCADE
        SQL);
    }

    public function down(Schema $schema): void
    {
        // this down() migration is auto-generated, please modify it to your needs
        $this->addSql('ALTER TABLE accounting_document DROP FOREIGN KEY FK_60EDA7843CBC65BC');
        $this->addSql('ALTER TABLE document_event DROP FOREIGN KEY FK_520F7CD5C33F7837');
        $this->addSql('ALTER TABLE validation DROP FOREIGN KEY FK_16AC5B6EC33F7837');
        $this->addSql('DROP TABLE accounting_document');
        $this->addSql('DROP TABLE document_event');
        $this->addSql('DROP TABLE validation');
    }
}
