<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Auto-generated Migration: Please modify to your needs!
 */
final class Version20261104132846 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'client-file-service : dossiers clients et historique des affectations';
    }

    public function up(Schema $schema): void
    {
        // this up() migration is auto-generated, please modify it to your needs
        $this->addSql(<<<'SQL'
            CREATE TABLE client_file (
              id BINARY(16) NOT NULL,
              reference VARCHAR(20) NOT NULL,
              workspace_id BINARY(16) NOT NULL,
              accountant_id VARCHAR(64) NOT NULL,
              accountant_display_name VARCHAR(150) NOT NULL,
              workspace_active TINYINT NOT NULL,
              entrepreneur_id VARCHAR(64) NOT NULL,
              entrepreneur_display_name VARCHAR(150) DEFAULT NULL,
              startup_id VARCHAR(64) DEFAULT NULL,
              startup_name VARCHAR(150) NOT NULL,
              request_message LONGTEXT DEFAULT NULL,
              status VARCHAR(20) NOT NULL,
              rejection_reason LONGTEXT DEFAULT NULL,
              decided_at DATETIME DEFAULT NULL,
              closed_at DATETIME DEFAULT NULL,
              created_at DATETIME NOT NULL,
              updated_at DATETIME NOT NULL,
              UNIQUE INDEX UNIQ_5D03F572AEA34913 (reference),
              INDEX idx_client_file_entrepreneur (entrepreneur_id),
              INDEX idx_client_file_accountant (accountant_id),
              INDEX idx_client_file_workspace (workspace_id),
              INDEX idx_client_file_status (status),
              PRIMARY KEY (id)
            ) DEFAULT CHARACTER SET utf8mb4
        SQL);
        $this->addSql(<<<'SQL'
            CREATE TABLE client_file_assignment (
              id BINARY(16) NOT NULL,
              type VARCHAR(30) NOT NULL,
              previous_accountant_id VARCHAR(64) DEFAULT NULL,
              new_accountant_id VARCHAR(64) NOT NULL,
              assigned_by VARCHAR(64) NOT NULL,
              reason LONGTEXT DEFAULT NULL,
              assigned_at DATETIME NOT NULL,
              client_file_id BINARY(16) NOT NULL,
              INDEX IDX_F40BC2FFC1F63D11 (client_file_id),
              PRIMARY KEY (id)
            ) DEFAULT CHARACTER SET utf8mb4
        SQL);
        $this->addSql(<<<'SQL'
            ALTER TABLE
              client_file_assignment
            ADD
              CONSTRAINT FK_F40BC2FFC1F63D11 FOREIGN KEY (client_file_id) REFERENCES client_file (id) ON DELETE CASCADE
        SQL);
    }

    public function down(Schema $schema): void
    {
        // this down() migration is auto-generated, please modify it to your needs
        $this->addSql('ALTER TABLE client_file_assignment DROP FOREIGN KEY FK_F40BC2FFC1F63D11');
        $this->addSql('DROP TABLE client_file');
        $this->addSql('DROP TABLE client_file_assignment');
    }
}
