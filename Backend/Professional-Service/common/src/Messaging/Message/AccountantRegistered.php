<?php

namespace Launchpad\Common\Messaging\Message;

/**
 * Publié par User-Service quand un utilisateur s'inscrit avec le rôle ACCOUNTANT
 * (ou rejoué au démarrage de User-Service pour les comptables déjà inscrits).
 * Consommé par workspace-service : il crée l'espace du comptable, ouvert aux demandes,
 * pour qu'il apparaisse tout de suite dans l'annuaire proposé aux entrepreneurs.
 */
final class AccountantRegistered implements QueueMessage
{
    public function __construct(
        public readonly string $accountantId,
        public readonly string $displayName,
        public readonly ?string $email = null,
        public readonly string $registeredAt = '',
    ) {
    }

    /**
     * @param array<string, mixed> $data
     */
    public static function fromArray(array $data): self
    {
        $accountantId = trim((string) ($data['accountantId'] ?? ''));
        if ('' === $accountantId) {
            throw new \InvalidArgumentException('accountantId manquant dans le message.');
        }
        $displayName = trim((string) ($data['displayName'] ?? ''));

        return new self(
            accountantId: $accountantId,
            displayName: '' !== $displayName ? mb_substr($displayName, 0, 150) : $accountantId,
            email: isset($data['email']) && '' !== $data['email'] ? (string) $data['email'] : null,
            registeredAt: (string) ($data['registeredAt'] ?? ''),
        );
    }

    public function toArray(): array
    {
        return [
            'accountantId' => $this->accountantId,
            'displayName' => $this->displayName,
            'email' => $this->email,
            'registeredAt' => $this->registeredAt,
        ];
    }
}
