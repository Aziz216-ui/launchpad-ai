<?php

namespace App\Repository;

use App\Entity\ClientFile;
use App\Entity\Message;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\ORM\QueryBuilder;
use Doctrine\Persistence\ManagerRegistry;
use Symfony\Bridge\Doctrine\Types\UuidType;

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
    public function createByClientFileQuery(ClientFile $clientFile): QueryBuilder
    {
        return $this->createQueryBuilder('m')
            ->andWhere('m.clientFile = :clientFile')
            ->setParameter('clientFile', $clientFile->getId(), UuidType::NAME)
            ->orderBy('m.createdAt', 'DESC')
            ->addOrderBy('m.id', 'DESC');
    }
}
