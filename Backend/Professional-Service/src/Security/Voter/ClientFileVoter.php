<?php

namespace App\Security\Voter;

use App\Entity\ClientFile;
use App\Enum\UserRole;
use App\Security\ActorResolver;
use App\Security\KeycloakUser;
use Symfony\Component\Security\Core\Authentication\Token\TokenInterface;
use Symfony\Component\Security\Core\Authorization\Voter\Vote;
use Symfony\Component\Security\Core\Authorization\Voter\Voter;

/**
 * Qui peut faire quoi sur un dossier. Les règles d'état (statut du dossier)
 * sont vérifiées par les services métier (réponse 409).
 *
 * @extends Voter<string, ClientFile>
 */
final class ClientFileVoter extends Voter
{
    public const VIEW = 'CLIENT_FILE_VIEW';
    public const UPDATE = 'CLIENT_FILE_UPDATE';
    public const ACCEPT = 'CLIENT_FILE_ACCEPT';
    public const REJECT = 'CLIENT_FILE_REJECT';
    public const CLOSE = 'CLIENT_FILE_CLOSE';
    public const ASSIGN = 'CLIENT_FILE_ASSIGN';
    public const UPLOAD_DOCUMENT = 'CLIENT_FILE_UPLOAD_DOCUMENT';
    public const DECLARE_EXTERNAL_DOCUMENT = 'CLIENT_FILE_DECLARE_EXTERNAL_DOCUMENT';
    public const SEND_MESSAGE = 'CLIENT_FILE_SEND_MESSAGE';

    private const ATTRIBUTES = [
        self::VIEW, self::UPDATE, self::ACCEPT, self::REJECT, self::CLOSE, self::ASSIGN,
        self::UPLOAD_DOCUMENT, self::DECLARE_EXTERNAL_DOCUMENT, self::SEND_MESSAGE,
    ];

    public function __construct(private readonly ActorResolver $actors)
    {
    }

    protected function supports(string $attribute, mixed $subject): bool
    {
        return $subject instanceof ClientFile && \in_array($attribute, self::ATTRIBUTES, true);
    }

    protected function voteOnAttribute(string $attribute, mixed $subject, TokenInterface $token, ?Vote $vote = null): bool
    {
        $user = $token->getUser();
        if (!$user instanceof KeycloakUser) {
            return false;
        }

        $isAdmin = $user->hasRole(UserRole::ADMIN);
        $isOwner = $this->actors->isOwner($user, $subject);
        $isActingAccountant = $this->actors->isActingAccountant($user, $subject);

        return match ($attribute) {
            // Un comptable dont l'espace est désactivé garde la lecture seule
            self::VIEW => $isAdmin || $isOwner || $this->actors->isAssignedAccountant($user, $subject),
            self::UPDATE, self::DECLARE_EXTERNAL_DOCUMENT => $isOwner,
            self::ACCEPT, self::REJECT => $isActingAccountant,
            self::CLOSE => $isActingAccountant || $isAdmin,
            self::ASSIGN => $isAdmin,
            // L'administrateur est en lecture seule sur les documents et les messages
            self::UPLOAD_DOCUMENT, self::SEND_MESSAGE => $isOwner || $isActingAccountant,
            default => false,
        };
    }
}
