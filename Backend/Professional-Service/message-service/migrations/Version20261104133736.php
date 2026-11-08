<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Auto-generated Migration: Please modify to your needs!
 */
final class Version20261104133736 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'message-service : messages des dossiers';
    }

    public function up(Schema $schema): void
    {
        // this up() migration is auto-generated, please modify it to your needs
        $this->addSql(<<<'SQL'
            CREATE TABLE message (
              id BINARY(16) NOT NULL,
              client_file_id BINARY(16) NOT NULL,
              document_id BINARY(16) DEFAULT NULL,
              sender_id VARCHAR(64) NOT NULL,
              sender_role VARCHAR(20) NOT NULL,
              content LONGTEXT NOT NULL,
              read_at DATETIME DEFAULT NULL,
              created_at DATETIME NOT NULL,
              INDEX idx_message_client_file (client_file_id),
              PRIMARY KEY (id)
            ) DEFAULT CHARACTER SET utf8mb4
        SQL);
    }

    public function down(Schema $schema): void
    {
        // this down() migration is auto-generated, please modify it to your needs
        $this->addSql('DROP TABLE message');
    }
}
