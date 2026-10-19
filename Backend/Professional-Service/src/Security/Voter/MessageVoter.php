<?php

namespace App\Security\Voter;

use App\Entity\Message;
use App\Security\ActorResolver;
use App\Security\KeycloakUser;
use Symfony\Component\Security\Core\Authentication\Token\TokenInterface;
use Symfony\Component\Security\Core\Authorization\Voter\Vote;
use Symfony\Component\Security\Core\Authorization\Voter\Voter;

/**
 * @extends Voter<string, Message>
 */
final class MessageVoter extends Voter
{
    /** Marquer comme lu : réservé au destinataire (participant du dossier qui n'est pas l'expéditeur). */
    public const MARK_READ = 'MESSAGE_MARK_READ';

    public function __construct(private readonly ActorResolver $actors)
    {
    }

    protected function supports(string $attribute, mixed $subject): bool
    {
        return self::MARK_READ === $attribute && $subject instanceof Message;
    }

    protected function voteOnAttribute(string $attribute, mixed $subject, TokenInterface $token, ?Vote $vote = null): bool
    {
        $user = $token->getUser();
        if (!$user instanceof KeycloakUser || $subject->getSenderId() === $user->getId()) {
            return false;
        }

        $file = $subject->getClientFile();

        return $this->actors->isOwner($user, $file) || $this->actors->isAssignedAccountant($user, $file);
    }
}
