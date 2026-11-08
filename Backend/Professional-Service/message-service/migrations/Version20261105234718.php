<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Auto-generated Migration: Please modify to your needs!
 */
final class Version20261105234718 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'message-service : notifications automatiques (colonne automatic, alimentée par RabbitMQ)';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE message ADD automatic TINYINT DEFAULT 0 NOT NULL');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE message DROP automatic');
    }
}
