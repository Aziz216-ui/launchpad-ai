<?php

namespace App\Repository;

use App\Entity\Message;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\DBAL\ArrayParameterType;
use Doctrine\ORM\QueryBuilder;
use Doctrine\Persistence\ManagerRegistry;
use Symfony\Bridge\Doctrine\Types\UuidType;
use Symfony\Component\Uid\Uuid;

/**
 * @extends ServiceEntityRepository<Message>
 */
class MessageRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, Message::class);
    }

    /** Fil de discussion d'un dossier, du plus récent au plus ancien. */
    public function createByClientFileQuery(string $clientFileId): QueryBuilder
    {
        return $this->createQueryBuilder('m')
            ->andWhere('m.clientFileId = :clientFile')
            ->setParameter('clientFile', Uuid::fromString($clientFileId), UuidType::NAME)
            ->orderBy('m.createdAt', 'DESC')
            ->addOrderBy('m.id', 'DESC');
    }

    /**
     * Messages non lus d'un utilisateur dans ses dossiers : envoyés par l'autre participant
     * (ou notifications automatiques), sans date de lecture. Le plus récent d'abord.
     *
     * @param list<string> $clientFileIds
     */
    public function createUnreadQuery(array $clientFileIds, string $userId): QueryBuilder
    {
        return $this->createQueryBuilder('m')
            ->andWhere('m.clientFileId IN (:files)')
            ->andWhere('m.senderId <> :user')
            ->andWhere('m.readAt IS NULL')
            ->setParameter('files', array_map(static fn (string $id): string => Uuid::fromString($id)->toBinary(), $clientFileIds), ArrayParameterType::BINARY)
            ->setParameter('user', $userId)
            ->orderBy('m.createdAt', 'DESC')
            ->addOrderBy('m.id', 'DESC');
    }
}
