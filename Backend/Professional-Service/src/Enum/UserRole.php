<?php

namespace App\Enum;

/**
 * Rôles métier internes, indépendants des noms de rôles Keycloak
 * (la correspondance est configurée dans .env).
 * Un rôle SERVICE (client_credentials) pourra être ajouté ici.
 */
enum UserRole: string
{
    case ACCOUNTANT = 'ACCOUNTANT';
    case ENTREPRENEUR = 'ENTREPRENEUR';
    case ADMIN = 'ADMIN';

    /** Rôle Symfony correspondant. */
    public function securityRole(): string
    {
        return 'ROLE_'.$this->value;
    }
}
