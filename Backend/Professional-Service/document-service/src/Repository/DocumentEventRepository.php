<?php

namespace App\Repository;

use App\Entity\AccountingDocument;
use App\Entity\DocumentEvent;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\ORM\QueryBuilder;
use Doctrine\Persistence\ManagerRegistry;
use Symfony\Bridge\Doctrine\Types\UuidType;

/**
 * @extends ServiceEntityRepository<DocumentEvent>
 */
class DocumentEventRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, DocumentEvent::class);
    }

    public function createByDocumentQuery(AccountingDocument $document): QueryBuilder
    {
        return $this->createQueryBuilder('e')
            ->andWhere('e.document = :document')
            ->setParameter('document', $document->getId(), UuidType::NAME)
            ->orderBy('e.createdAt', 'DESC')
            ->addOrderBy('e.id', 'DESC');
    }
}
