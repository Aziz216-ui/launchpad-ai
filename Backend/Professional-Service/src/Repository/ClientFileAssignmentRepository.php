<?php

namespace App\Repository;

use App\Entity\ClientFile;
use App\Entity\ClientFileAssignment;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\ORM\QueryBuilder;
use Doctrine\Persistence\ManagerRegistry;
use Symfony\Bridge\Doctrine\Types\UuidType;

/**
 * @extends ServiceEntityRepository<ClientFileAssignment>
 */
class ClientFileAssignmentRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, ClientFileAssignment::class);
    }

    public function createByClientFileQuery(ClientFile $clientFile): QueryBuilder
    {
        return $this->createQueryBuilder('a')
            ->andWhere('a.clientFile = :clientFile')
            ->setParameter('clientFile', $clientFile->getId(), UuidType::NAME)
            ->orderBy('a.assignedAt', 'DESC')
            ->addOrderBy('a.id', 'DESC');
    }
}
