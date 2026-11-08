<?php

namespace App\Security\Voter;

use App\Entity\ClientFile;
use Launchpad\Common\Enum\UserRole;
use Launchpad\Common\Security\ActorResolver;
use Launchpad\Common\Security\KeycloakUser;
use Symfony\Component\Security\Core\Authentication\Token\TokenInterface;
use Symfony\Component\Security\Core\Authorization\Voter\Vote;
use Symfony\Component\Security\Core\Authorization\Voter\Voter;

/**
 * Qui peut faire quoi sur un dossier. Les règles d'état (statut du dossier)
 * sont vérifiées par les services métier (réponse 409).
 * Documents et messages : mêmes règles, appliquées par FileContextVoter dans leurs services.
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

    private const ATTRIBUTES = [self::VIEW, self::UPDATE, self::ACCEPT, self::REJECT, self::CLOSE, self::ASSIGN];

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

        $file = $subject->toContext();
        $isAdmin = $user->hasRole(UserRole::ADMIN);
        $isActingAccountant = $this->actors->isActingAccountant($user, $file);

        return match ($attribute) {
            // Un comptable dont l'espace est désactivé garde la lecture seule
            self::VIEW => $this->actors->canView($user, $file),
            self::UPDATE => $this->actors->isOwner($user, $file),
            self::ACCEPT, self::REJECT => $isActingAccountant,
            self::CLOSE => $isActingAccountant || $isAdmin,
            self::ASSIGN => $isAdmin,
            default => false,
        };
    }
}
