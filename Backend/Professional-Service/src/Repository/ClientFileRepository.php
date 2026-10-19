<?php

namespace App\Repository;

use App\Entity\AccountantWorkspace;
use App\Entity\ClientFile;
use App\Enum\ClientFileStatus;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\ORM\QueryBuilder;
use Doctrine\Persistence\ManagerRegistry;
use Symfony\Bridge\Doctrine\Types\UuidType;

/**
 * @extends ServiceEntityRepository<ClientFile>
 */
class ClientFileRepository extends ServiceEntityRepository
{
    public const REFERENCE_PREFIX = 'DOS';

    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, ClientFile::class);
    }

    /**
     * Liste filtrée des dossiers. Les filtres accountantId / entrepreneurId
     * permettent de restreindre la visibilité selon l'utilisateur courant.
     */
    public function createFilteredQuery(
        ?string $accountantId = null,
        ?string $entrepreneurId = null,
        ?ClientFileStatus $status = null,
    ): QueryBuilder {
        $qb = $this->createQueryBuilder('f')
            ->addSelect('w')
            ->innerJoin('f.workspace', 'w')
            ->orderBy('f.createdAt', 'DESC');

        if (null !== $accountantId) {
            $qb->andWhere('w.accountantId = :accountantId')->setParameter('accountantId', $accountantId);
        }
        if (null !== $entrepreneurId) {
            $qb->andWhere('f.entrepreneurId = :entrepreneurId')->setParameter('entrepreneurId', $entrepreneurId);
        }
        if (null !== $status) {
            $qb->andWhere('f.status = :status')->setParameter('status', $status->value);
        }

        return $qb;
    }

    /**
     * Existe-t-il déjà une demande en attente ou un dossier actif pour cette startup chez ce comptable ?
     */
    public function hasOpenFile(
        string $entrepreneurId,
        AccountantWorkspace $workspace,
        ?string $startupId,
        string $startupName,
    ): bool {
        $qb = $this->createQueryBuilder('f')
            ->select('COUNT(f.id)')
            ->andWhere('f.entrepreneurId = :entrepreneurId')
            ->andWhere('f.workspace = :workspace')
            ->andWhere('f.status IN (:statuses)')
            ->setParameter('entrepreneurId', $entrepreneurId)
            ->setParameter('workspace', $workspace->getId(), UuidType::NAME)
            ->setParameter('statuses', [ClientFileStatus::PENDING->value, ClientFileStatus::ACTIVE->value]);

        if (null !== $startupId) {
            $qb->andWhere('f.startupId = :startupId')->setParameter('startupId', $startupId);
        } else {
            $qb->andWhere('f.startupName = :startupName')->setParameter('startupName', $startupName);
        }

        return (int) $qb->getQuery()->getSingleScalarResult() > 0;
    }

    /**
     * @return list<ClientFile>
     */
    public function findPendingByWorkspace(AccountantWorkspace $workspace): array
    {
        return $this->createQueryBuilder('f')
            ->andWhere('f.workspace = :workspace')
            ->andWhere('f.status = :status')
            ->setParameter('workspace', $workspace->getId(), UuidType::NAME)
            ->setParameter('status', ClientFileStatus::PENDING->value)
            ->getQuery()
            ->getResult();
    }

    /**
     * Prochaine référence lisible pour l'année donnée, ex. DOS-2026-000042.
     * L'unicité est garantie par la contrainte unique sur la colonne.
     */
    public function nextReference(int $year): string
    {
        $prefix = sprintf('%s-%d-', self::REFERENCE_PREFIX, $year);

        $last = $this->createQueryBuilder('f')
            ->select('MAX(f.reference)')
            ->andWhere('f.reference LIKE :prefix')
            ->setParameter('prefix', $prefix.'%')
            ->getQuery()
            ->getSingleScalarResult();

        $sequence = null === $last ? 1 : (int) substr($last, strlen($prefix)) + 1;

        return sprintf('%s%06d', $prefix, $sequence);
    }
}
