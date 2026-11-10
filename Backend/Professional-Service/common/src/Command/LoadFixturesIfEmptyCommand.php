<?php

namespace Launchpad\Common\Command;

use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Exception\CommandNotFoundException;
use Symfony\Component\Console\Input\ArrayInput;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;

/**
 * Charge les données de démonstration uniquement si la base du service est vide.
 *
 * Utilisée par docker-entrypoint.sh à chaque démarrage de conteneur. doctrine:fixtures:load vide la base
 * avant de la remplir : sans ce garde-fou, recréer un conteneur (docker compose up --build) effaçait
 * toutes les données saisies (dossiers, documents, messages, espaces des comptables inscrits).
 */
#[AsCommand(name: 'app:fixtures:load-if-empty', description: 'Charge les fixtures seulement si aucune table du service ne contient de données')]
final class LoadFixturesIfEmptyCommand extends Command
{
    public function __construct(private readonly EntityManagerInterface $em)
    {
        parent::__construct();
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);

        foreach ($this->em->getMetadataFactory()->getAllMetadata() as $metadata) {
            if ($metadata->isMappedSuperclass || $metadata->isEmbeddedClass) {
                continue;
            }
            $hasRows = $this->em->createQueryBuilder()
                ->select('1')
                ->from($metadata->getName(), 'e')
                ->setMaxResults(1)
                ->getQuery()
                ->getOneOrNullResult();
            if (null !== $hasRows) {
                $io->writeln(sprintf('Données existantes (%s) : fixtures ignorées.', $metadata->getTableName()));

                return Command::SUCCESS;
            }
        }

        try {
            $load = $this->getApplication()?->find('doctrine:fixtures:load');
        } catch (CommandNotFoundException) {
            $load = null;
        }
        if (null === $load) {
            $io->warning('Base vide, mais doctrine:fixtures:load n\'est pas disponible dans cet environnement.');

            return Command::SUCCESS;
        }

        $io->writeln('Base vide : chargement des données de démonstration.');
        $arguments = new ArrayInput(['--no-interaction' => true]);
        $arguments->setInteractive(false);

        return $load->run($arguments, $output);
    }
}
