<?php

namespace Launchpad\Common\Security\Voter;

use Launchpad\Common\Remote\Model\FileContext;
use Launchpad\Common\Security\ActorResolver;
use Launchpad\Common\Security\KeycloakUser;
use Symfony\Component\Security\Core\Authentication\Token\TokenInterface;
use Symfony\Component\Security\Core\Authorization\Voter\Vote;
use Symfony\Component\Security\Core\Authorization\Voter\Voter;

/**
 * Droits sur un dossier vu depuis un autre service (documents, messages).
 * Les règles d'état (statut du dossier) sont vérifiées par les services métier (409).
 *
 * @extends Voter<string, FileContext>
 */
final class FileContextVoter extends Voter
{
    public const VIEW = 'FILE_VIEW';
    public const UPLOAD_DOCUMENT = 'FILE_UPLOAD_DOCUMENT';
    public const DECLARE_EXTERNAL_DOCUMENT = 'FILE_DECLARE_EXTERNAL_DOCUMENT';
    public const SEND_MESSAGE = 'FILE_SEND_MESSAGE';

    private const ATTRIBUTES = [self::VIEW, self::UPLOAD_DOCUMENT, self::DECLARE_EXTERNAL_DOCUMENT, self::SEND_MESSAGE];

    public function __construct(private readonly ActorResolver $actors)
    {
    }

    protected function supports(string $attribute, mixed $subject): bool
    {
        return $subject instanceof FileContext && \in_array($attribute, self::ATTRIBUTES, true);
    }

    protected function voteOnAttribute(string $attribute, mixed $subject, TokenInterface $token, ?Vote $vote = null): bool
    {
        $user = $token->getUser();
        if (!$user instanceof KeycloakUser) {
            return false;
        }

        return match ($attribute) {
            // Un comptable dont l'espace est désactivé garde la lecture seule
            self::VIEW => $this->actors->canView($user, $subject),
            self::DECLARE_EXTERNAL_DOCUMENT => $this->actors->isOwner($user, $subject),
            // L'administrateur est en lecture seule sur les documents et les messages
            self::UPLOAD_DOCUMENT, self::SEND_MESSAGE => $this->actors->isOwner($user, $subject)
                || $this->actors->isActingAccountant($user, $subject),
            default => false,
        };
    }
}
