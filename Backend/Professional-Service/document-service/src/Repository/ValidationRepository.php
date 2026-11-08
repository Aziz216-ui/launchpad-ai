<?php

namespace App\Repository;

use App\Entity\AccountingDocument;
use App\Entity\Validation;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\ORM\QueryBuilder;
use Doctrine\Persistence\ManagerRegistry;
use Symfony\Bridge\Doctrine\Types\UuidType;

/**
 * @extends ServiceEntityRepository<Validation>
 */
class ValidationRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, Validation::class);
    }

    /** Historique des décisions, du plus récent au plus ancien. */
    public function createByDocumentQuery(AccountingDocument $document): QueryBuilder
    {
        return $this->createQueryBuilder('v')
            ->andWhere('v.document = :document')
            ->setParameter('document', $document->getId(), UuidType::NAME)
            ->orderBy('v.createdAt', 'DESC')
            ->addOrderBy('v.id', 'DESC');
    }
}
