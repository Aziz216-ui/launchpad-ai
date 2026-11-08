<?php

namespace App\Repository;

use App\Entity\Message;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
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
}
