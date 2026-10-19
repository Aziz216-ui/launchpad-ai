<?php

namespace App\Security\Voter;

use App\Entity\AccountingDocument;
use App\Enum\UserRole;
use App\Security\ActorResolver;
use App\Security\KeycloakUser;
use Symfony\Component\Security\Core\Authentication\Token\TokenInterface;
use Symfony\Component\Security\Core\Authorization\Voter\Vote;
use Symfony\Component\Security\Core\Authorization\Voter\Voter;

/**
 * @extends Voter<string, AccountingDocument>
 */
final class AccountingDocumentVoter extends Voter
{
    public const VIEW = 'DOCUMENT_VIEW';
    public const DOWNLOAD = 'DOCUMENT_DOWNLOAD';
    public const DECIDE = 'DOCUMENT_DECIDE';
    public const DELETE = 'DOCUMENT_DELETE';
    public const NEW_VERSION = 'DOCUMENT_NEW_VERSION';

    private const ATTRIBUTES = [self::VIEW, self::DOWNLOAD, self::DECIDE, self::DELETE, self::NEW_VERSION];

    public function __construct(private readonly ActorResolver $actors)
    {
    }

    protected function supports(string $attribute, mixed $subject): bool
    {
        return $subject instanceof AccountingDocument && \in_array($attribute, self::ATTRIBUTES, true);
    }

    protected function voteOnAttribute(string $attribute, mixed $subject, TokenInterface $token, ?Vote $vote = null): bool
    {
        $user = $token->getUser();
        if (!$user instanceof KeycloakUser) {
            return false;
        }

        $file = $subject->getClientFile();
        $isOwner = $this->actors->isOwner($user, $file);
        $isActingAccountant = $this->actors->isActingAccountant($user, $file);

        return match ($attribute) {
            self::VIEW, self::DOWNLOAD => $user->hasRole(UserRole::ADMIN)
                || $isOwner
                || $this->actors->isAssignedAccountant($user, $file),
            // Validation réservée au comptable affecté (pas à l'administrateur)
            self::DECIDE => $isActingAccountant,
            // Chacun ne supprime que les documents de son camp
            self::DELETE => ($isOwner && UserRole::ENTREPRENEUR === $subject->getUploadedByRole() && $subject->getUploadedBy() === $user->getId())
                || ($isActingAccountant && UserRole::ACCOUNTANT === $subject->getUploadedByRole()),
            self::NEW_VERSION => $isOwner,
            default => false,
        };
    }
}
