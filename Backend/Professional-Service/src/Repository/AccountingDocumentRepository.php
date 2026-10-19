<?php

namespace App\Repository;

use App\Entity\AccountingDocument;
use App\Entity\ClientFile;
use App\Enum\DocumentStatus;
use App\Enum\DocumentType;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\ORM\QueryBuilder;
use Doctrine\Persistence\ManagerRegistry;
use Symfony\Bridge\Doctrine\Types\UuidType;

/**
 * @extends ServiceEntityRepository<AccountingDocument>
 */
class AccountingDocumentRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, AccountingDocument::class);
    }

    /**
     * Documents non supprimés d'un dossier.
     *
     * @param bool $includeHistory false : uniquement la dernière version de chaque document
     */
    public function createByClientFileQuery(
        ClientFile $clientFile,
        bool $includeHistory = false,
        ?DocumentStatus $status = null,
        ?DocumentType $type = null,
    ): QueryBuilder {
        $qb = $this->createQueryBuilder('d')
            ->andWhere('d.clientFile = :clientFile')
            ->andWhere('d.deletedAt IS NULL')
            ->setParameter('clientFile', $clientFile->getId(), UuidType::NAME)
            ->orderBy('d.uploadedAt', 'DESC')
            ->addOrderBy('d.id', 'DESC');

        if (!$includeHistory) {
            // Dernière version = aucune version suivante non supprimée
            $qb->leftJoin(AccountingDocument::class, 'next', 'WITH', 'next.previousVersion = d AND next.deletedAt IS NULL')
                ->andWhere('next.id IS NULL');
        }
        if (null !== $status) {
            $qb->andWhere('d.status = :status')->setParameter('status', $status->value);
        }
        if (null !== $type) {
            $qb->andWhere('d.type = :type')->setParameter('type', $type->value);
        }

        return $qb;
    }

    /** Une version plus récente (non supprimée) de ce document existe-t-elle ? */
    public function hasNextVersion(AccountingDocument $document): bool
    {
        return (int) $this->createQueryBuilder('d')
            ->select('COUNT(d.id)')
            ->andWhere('d.previousVersion = :document')
            ->andWhere('d.deletedAt IS NULL')
            ->setParameter('document', $document->getId(), UuidType::NAME)
            ->getQuery()
            ->getSingleScalarResult() > 0;
    }
}
