<?php

namespace App\Command;

use App\Discovery\EurekaClient;
use App\Discovery\EurekaException;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Command\SignalableCommandInterface;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;

/**
 * Enregistre le service dans Eureka puis envoie un battement de cœur à intervalle régulier.
 * À l'arrêt (Ctrl+C), l'instance est retirée d'Eureka.
 * Lancé automatiquement par "composer serve" quand EUREKA_ENABLED=true.
 */
#[AsCommand(name: 'app:eureka:register', description: 'Enregistre le service dans Eureka et maintient l\'enregistrement')]
final class EurekaRegisterCommand extends Command implements SignalableCommandInterface
{
    private bool $stopRequested = false;

    public function __construct(private readonly EurekaClient $eureka)
    {
        parent::__construct();
    }

    protected function configure(): void
    {
        $this->addOption('max-heartbeats', null, InputOption::VALUE_REQUIRED, 'Arrête après N battements de cœur (0 = sans fin)', '0');
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);
        $maxHeartbeats = (int) $input->getOption('max-heartbeats');
        $interval = max(1, $this->eureka->getHeartbeatInterval());

        // Windows : Ctrl+C ne passe pas par pcntl
        if (\function_exists('sapi_windows_set_ctrl_handler')) {
            sapi_windows_set_ctrl_handler(function (): void {
                $this->stopRequested = true;
            });
        }

        $registered = false;
        $heartbeats = 0;

        while (!$this->stopRequested) {
            try {
                if (!$registered) {
                    $this->eureka->register();
                    $registered = true;
                    $io->writeln(sprintf('<info>[Eureka]</info> Instance %s enregistrée sous %s.', $this->eureka->getInstanceId(), $this->eureka->getAppName()));
                } elseif ($this->eureka->heartbeat()) {
                    $io->writeln('<comment>[Eureka]</comment> Instance inconnue du serveur : réenregistrée.');
                }
            } catch (EurekaException $e) {
                // Eureka arrêté ou indisponible : on réessaie au prochain intervalle
                $registered = false;
                $io->writeln(sprintf('<error>[Eureka]</error> %s Nouvel essai dans %d s.', $e->getMessage(), $interval));
            }

            if ($registered && $maxHeartbeats > 0 && ++$heartbeats > $maxHeartbeats) {
                break;
            }

            $this->wait($interval);
        }

        if ($registered) {
            try {
                $this->eureka->deregister();
                $io->writeln('<info>[Eureka]</info> Instance retirée d\'Eureka.');
            } catch (EurekaException $e) {
                $io->writeln(sprintf('<error>[Eureka]</error> Désinscription impossible : %s', $e->getMessage()));
            }
        }

        return Command::SUCCESS;
    }

    public function getSubscribedSignals(): array
    {
        return array_values(array_filter([\defined('SIGINT') ? \SIGINT : null, \defined('SIGTERM') ? \SIGTERM : null]));
    }

    public function handleSignal(int $signal, int|false $previousExitCode = 0): int|false
    {
        $this->stopRequested = true;

        // false : la commande continue pour se désinscrire proprement
        return false;
    }

    /** Attente découpée en secondes pour réagir vite à une demande d'arrêt. */
    private function wait(int $seconds): void
    {
        for ($i = 0; $i < $seconds && !$this->stopRequested; ++$i) {
            sleep(1);
        }
    }
}
