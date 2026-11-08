<?php

namespace Launchpad\Common\Command;

use Launchpad\Common\Messaging\MessagingException;
use Launchpad\Common\Messaging\QueueConsumer;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;

/**
 * Lance les consommateurs RabbitMQ du service (à démarrer avant les producteurs, comme dans l'atelier).
 *   php bin/console app:rabbitmq:consume            écoute en continu
 *   php bin/console app:rabbitmq:consume --setup    déclare seulement les queues, puis s'arrête
 */
#[AsCommand(name: 'app:rabbitmq:consume', description: 'Déclare les queues de ce service et consomme leurs messages RabbitMQ')]
final class RabbitMqConsumeCommand extends Command
{
    public function __construct(private readonly QueueConsumer $consumer)
    {
        parent::__construct();
    }

    protected function configure(): void
    {
        $this
            ->addOption('setup', null, InputOption::VALUE_NONE, 'Déclarer les queues puis s\'arrêter')
            ->addOption('limit', null, InputOption::VALUE_REQUIRED, 'S\'arrêter après N messages')
            ->addOption('idle-timeout', null, InputOption::VALUE_REQUIRED, 'S\'arrêter après N secondes sans message');
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);

        if ([] === $this->consumer->queues()) {
            $io->warning('Ce service ne consomme aucune queue RabbitMQ.');

            return Command::SUCCESS;
        }

        try {
            $queues = $this->consumer->declareQueues();
            $io->writeln(sprintf('Queues déclarées (durables) : <info>%s</info>', implode(', ', $queues)));

            if ($input->getOption('setup')) {
                return Command::SUCCESS;
            }

            $io->writeln('En attente de messages… (Ctrl+C pour arrêter)');
            $limit = $input->getOption('limit');
            $idle = $input->getOption('idle-timeout');
            $handled = $this->consumer->consume(null !== $limit ? (int) $limit : null, null !== $idle ? (int) $idle : null);
            $io->writeln(sprintf('%d message(s) traité(s).', $handled));
        } catch (MessagingException $e) {
            $io->error($e->getMessage());

            return Command::FAILURE;
        }

        return Command::SUCCESS;
    }
}
