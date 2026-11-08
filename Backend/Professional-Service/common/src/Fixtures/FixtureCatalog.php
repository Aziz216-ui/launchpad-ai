<?php

namespace Launchpad\Common\Fixtures;

use Launchpad\Common\Remote\Model\FileContext;
use Symfony\Component\Uid\Uuid;

/**
 * Données de démonstration partagées par les microservices.
 *
 * Chaque service a sa propre base : les références entre services (dossier d'un document,
 * document cité dans un message…) ne tiennent que si les identifiants sont les mêmes partout.
 * Ce catalogue fixe ces identifiants ; les fixtures de chaque service et les doublures de test s'y réfèrent.
 */
final class FixtureCatalog
{
    // --- Espaces comptables (workspace-service) -------------------------------------------
    public const WORKSPACE_SONIA = '019a1000-0000-7000-8000-000000000001';
    public const WORKSPACE_KARIM = '019a1000-0000-7000-8000-000000000002';
    public const WORKSPACE_CLAIRE = '019a1000-0000-7000-8000-000000000003';
    public const WORKSPACE_YOUSSEF = '019a1000-0000-7000-8000-000000000004';

    /** @var array<string, array{accountantId: string, displayName: string, acceptingClients: bool, active: bool}> */
    public const WORKSPACES = [
        self::WORKSPACE_SONIA => ['accountantId' => FixtureUsers::ACCOUNTANT_SONIA, 'displayName' => 'Sonia Ben Ammar', 'acceptingClients' => true, 'active' => true],
        self::WORKSPACE_KARIM => ['accountantId' => FixtureUsers::ACCOUNTANT_KARIM, 'displayName' => 'Karim Trabelsi', 'acceptingClients' => true, 'active' => true],
        // Espace créé à la première connexion, pas encore ouvert aux demandes
        self::WORKSPACE_CLAIRE => ['accountantId' => FixtureUsers::ACCOUNTANT_CLAIRE, 'displayName' => 'Claire Dubois', 'acceptingClients' => false, 'active' => true],
        // Espace désactivé par l'administration (départ du cabinet)
        self::WORKSPACE_YOUSSEF => ['accountantId' => FixtureUsers::ACCOUNTANT_YOUSSEF, 'displayName' => 'Youssef Mansouri', 'acceptingClients' => true, 'active' => false],
    ];

    // --- Dossiers clients (client-file-service) --------------------------------------------
    public const FILE_AGRISENSE = '019a2000-0000-7000-8000-000000000001';
    public const FILE_MEDICONNECT_PENDING = '019a2000-0000-7000-8000-000000000002';
    public const FILE_ECOLIVRAISON = '019a2000-0000-7000-8000-000000000003';
    public const FILE_MEDICONNECT_REJECTED = '019a2000-0000-7000-8000-000000000004';
    public const FILE_AGRISENSE_EXPORT_CLOSED = '019a2000-0000-7000-8000-000000000005';
    public const FILE_BOULANGERIE_PENDING_CLAIRE = '019a2000-0000-7000-8000-000000000006';

    /**
     * État des dossiers après chargement des fixtures (comptable actuellement affecté).
     *
     * @var array<string, array{reference: string, status: string, workspaceId: string, entrepreneurId: string}>
     */
    public const FILES = [
        self::FILE_AGRISENSE => ['reference' => FixtureUsers::FILE_AGRISENSE, 'status' => 'ACTIVE', 'workspaceId' => self::WORKSPACE_SONIA, 'entrepreneurId' => FixtureUsers::ENTREPRENEUR_AMINE],
        self::FILE_MEDICONNECT_PENDING => ['reference' => FixtureUsers::FILE_MEDICONNECT_PENDING, 'status' => 'PENDING', 'workspaceId' => self::WORKSPACE_SONIA, 'entrepreneurId' => FixtureUsers::ENTREPRENEUR_LEILA],
        // Réaffecté de Youssef à Karim
        self::FILE_ECOLIVRAISON => ['reference' => FixtureUsers::FILE_ECOLIVRAISON, 'status' => 'ACTIVE', 'workspaceId' => self::WORKSPACE_KARIM, 'entrepreneurId' => FixtureUsers::ENTREPRENEUR_THOMAS],
        self::FILE_MEDICONNECT_REJECTED => ['reference' => FixtureUsers::FILE_MEDICONNECT_REJECTED, 'status' => 'REJECTED', 'workspaceId' => self::WORKSPACE_KARIM, 'entrepreneurId' => FixtureUsers::ENTREPRENEUR_LEILA],
        self::FILE_AGRISENSE_EXPORT_CLOSED => ['reference' => FixtureUsers::FILE_AGRISENSE_EXPORT_CLOSED, 'status' => 'CLOSED', 'workspaceId' => self::WORKSPACE_KARIM, 'entrepreneurId' => FixtureUsers::ENTREPRENEUR_AMINE],
        self::FILE_BOULANGERIE_PENDING_CLAIRE => ['reference' => FixtureUsers::FILE_BOULANGERIE_PENDING_CLAIRE, 'status' => 'PENDING', 'workspaceId' => self::WORKSPACE_CLAIRE, 'entrepreneurId' => FixtureUsers::ENTREPRENEUR_THOMAS],
    ];

    // --- Documents (document-service) -------------------------------------------------------
    public const DOC_BILAN = '019a3000-0000-7000-8000-000000000001';
    public const DOC_RELEVE = '019a3000-0000-7000-8000-000000000002';
    public const DOC_PREVISIONNEL = '019a3000-0000-7000-8000-000000000003';
    public const DOC_FACTURES_V1 = '019a3000-0000-7000-8000-000000000004';
    public const DOC_FACTURES_V2 = '019a3000-0000-7000-8000-000000000005';
    public const DOC_RAPPORT = '019a3000-0000-7000-8000-000000000006';
    public const DOC_DOUBLON_DELETED = '019a3000-0000-7000-8000-000000000007';
    public const DOC_TVA = '019a3000-0000-7000-8000-000000000008';
    public const DOC_PAIE = '019a3000-0000-7000-8000-000000000009';
    public const DOC_COMPTES_ANNUELS = '019a3000-0000-7000-8000-000000000010';

    /** @var array<string, array{clientFileId: string, title: string, deleted: bool}> */
    public const DOCUMENTS = [
        self::DOC_BILAN => ['clientFileId' => self::FILE_AGRISENSE, 'title' => 'Bilan 2025', 'deleted' => false],
        self::DOC_RELEVE => ['clientFileId' => self::FILE_AGRISENSE, 'title' => 'Relevé bancaire — mars 2026', 'deleted' => false],
        self::DOC_PREVISIONNEL => ['clientFileId' => self::FILE_AGRISENSE, 'title' => 'Prévisionnel financier 2026-2028', 'deleted' => false],
        self::DOC_FACTURES_V1 => ['clientFileId' => self::FILE_AGRISENSE, 'title' => 'Factures fournisseurs T1 2026', 'deleted' => false],
        self::DOC_FACTURES_V2 => ['clientFileId' => self::FILE_AGRISENSE, 'title' => 'Factures fournisseurs T1 2026 (complètes)', 'deleted' => false],
        self::DOC_RAPPORT => ['clientFileId' => self::FILE_AGRISENSE, 'title' => 'Rapport de revue comptable T1 2026', 'deleted' => false],
        self::DOC_DOUBLON_DELETED => ['clientFileId' => self::FILE_AGRISENSE, 'title' => 'Relevé bancaire — mars 2026 (doublon)', 'deleted' => true],
        self::DOC_TVA => ['clientFileId' => self::FILE_ECOLIVRAISON, 'title' => 'Déclaration de TVA — T1 2026', 'deleted' => false],
        self::DOC_PAIE => ['clientFileId' => self::FILE_ECOLIVRAISON, 'title' => 'Journal de paie — mars 2026', 'deleted' => false],
        self::DOC_COMPTES_ANNUELS => ['clientFileId' => self::FILE_AGRISENSE_EXPORT_CLOSED, 'title' => 'Comptes annuels 2025', 'deleted' => false],
    ];

    /** Contexte d'un dossier des fixtures, tel que le renverrait client-file-service. */
    public static function fileContext(string $fileId): ?FileContext
    {
        $file = self::FILES[$fileId] ?? null;
        if (null === $file) {
            return null;
        }
        $workspace = self::WORKSPACES[$file['workspaceId']];

        return new FileContext($fileId, $file['reference'], $file['status'], $file['entrepreneurId'], $workspace['accountantId'], $workspace['active']);
    }

    public static function fileIdByReference(string $reference): string
    {
        foreach (self::FILES as $id => $file) {
            if ($file['reference'] === $reference) {
                return $id;
            }
        }

        throw new \InvalidArgumentException("Dossier $reference absent du catalogue.");
    }

    /**
     * Fixe l'identifiant d'une entité créée par les fixtures (les constructeurs génèrent un UUID v7).
     */
    public static function forceId(object $entity, string $id): void
    {
        $property = new \ReflectionProperty($entity, 'id');
        $property->setValue($entity, Uuid::fromString($id));
    }
}
