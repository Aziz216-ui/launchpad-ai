<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Auto-generated Migration: Please modify to your needs!
 */
final class Version20261104132315 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'workspace-service : espaces comptables';
    }

    public function up(Schema $schema): void
    {
        // this up() migration is auto-generated, please modify it to your needs
        $this->addSql(<<<'SQL'
            CREATE TABLE accountant_workspace (
              id BINARY(16) NOT NULL,
              accountant_id VARCHAR(64) NOT NULL,
              display_name VARCHAR(150) NOT NULL,
              accepting_clients TINYINT NOT NULL,
              active TINYINT NOT NULL,
              created_at DATETIME NOT NULL,
              updated_at DATETIME NOT NULL,
              UNIQUE INDEX UNIQ_B38866A39582AA74 (accountant_id),
              PRIMARY KEY (id)
            ) DEFAULT CHARACTER SET utf8mb4
        SQL);
    }

    public function down(Schema $schema): void
    {
        // this down() migration is auto-generated, please modify it to your needs
        $this->addSql('DROP TABLE accountant_workspace');
    }
}
