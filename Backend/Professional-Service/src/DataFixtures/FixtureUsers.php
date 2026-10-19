<?php

namespace App\DataFixtures;

/**
 * Identifiants Keycloak ("sub") des utilisateurs de démonstration.
 * Pour tester avec un vrai Keycloak, créez ces utilisateurs avec les mêmes ID
 * (import de realm) ou adaptez ces valeurs.
 */
final class FixtureUsers
{
    // Comptables
    public const ACCOUNTANT_SONIA = '7d3c9a52-1f4e-4b8a-9c21-5e6f7a8b9c01';
    public const ACCOUNTANT_KARIM = '7d3c9a52-1f4e-4b8a-9c21-5e6f7a8b9c02';
    public const ACCOUNTANT_CLAIRE = '7d3c9a52-1f4e-4b8a-9c21-5e6f7a8b9c03';
    public const ACCOUNTANT_YOUSSEF = '7d3c9a52-1f4e-4b8a-9c21-5e6f7a8b9c04';

    // Entrepreneurs
    public const ENTREPRENEUR_AMINE = 'e1f2a3b4-5c6d-4e7f-8a9b-0c1d2e3f4a01';
    public const ENTREPRENEUR_LEILA = 'e1f2a3b4-5c6d-4e7f-8a9b-0c1d2e3f4a02';
    public const ENTREPRENEUR_THOMAS = 'e1f2a3b4-5c6d-4e7f-8a9b-0c1d2e3f4a03';

    // Administration
    public const ADMIN_NADIA = 'ad5e1c00-3b7a-4d2f-9e8c-1a2b3c4d5e01';

    /** Références des dossiers créés par les fixtures. */
    public const FILE_AGRISENSE = 'DOS-2026-000001';
    public const FILE_MEDICONNECT_PENDING = 'DOS-2026-000002';
    public const FILE_ECOLIVRAISON = 'DOS-2026-000003';
    public const FILE_MEDICONNECT_REJECTED = 'DOS-2026-000004';
    public const FILE_AGRISENSE_EXPORT_CLOSED = 'DOS-2026-000005';
    public const FILE_BOULANGERIE_PENDING_CLAIRE = 'DOS-2026-000006';
}
