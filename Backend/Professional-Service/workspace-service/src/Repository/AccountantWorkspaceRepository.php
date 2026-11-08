<?php

namespace App\Repository;

use App\Entity\AccountantWorkspace;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\ORM\QueryBuilder;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<AccountantWorkspace>
 */
class AccountantWorkspaceRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, AccountantWorkspace::class);
    }

    public function findOneByAccountantId(string $accountantId): ?AccountantWorkspace
    {
        return $this->findOneBy(['accountantId' => $accountantId]);
    }

    /**
     * @param bool $onlyAvailable true : uniquement les espaces actifs qui acceptent des clients
     */
    public function createListQuery(bool $onlyAvailable): QueryBuilder
    {
        $qb = $this->createQueryBuilder('w')->orderBy('w.displayName', 'ASC');

        if ($onlyAvailable) {
            $qb->andWhere('w.active = true')->andWhere('w.acceptingClients = true');
        }

        return $qb;
    }
}
