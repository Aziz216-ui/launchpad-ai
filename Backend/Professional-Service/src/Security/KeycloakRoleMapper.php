<?php

namespace App\Security;

use App\Enum\UserRole;

/**
 * Traduit les rôles Keycloak (realm_access.roles et, si activé,
 * resource_access.<client>.roles) en rôles Symfony.
 * Les noms des rôles Keycloak viennent de la configuration (.env).
 */
final class KeycloakRoleMapper
{
    /** @var array<string, UserRole> nom Keycloak => rôle métier */
    private readonly array $mapping;

    public function __construct(
        private readonly string $keycloakClientId,
        private readonly bool $useClientRoles,
        string $accountantRoleName,
        string $entrepreneurRoleName,
        string $adminRoleName,
    ) {
        $this->mapping = [
            $accountantRoleName => UserRole::ACCOUNTANT,
            $entrepreneurRoleName => UserRole::ENTREPRENEUR,
            $adminRoleName => UserRole::ADMIN,
        ];
    }

    /**
     * @param array<string, mixed> $claims
     *
     * @return list<string> rôles Symfony
     */
    public function map(array $claims): array
    {
        $keycloakRoles = $this->stringList($claims['realm_access']['roles'] ?? []);

        if ($this->useClientRoles) {
            $clientRoles = $claims['resource_access'][$this->keycloakClientId]['roles'] ?? [];
            $keycloakRoles = [...$keycloakRoles, ...$this->stringList($clientRoles)];
        }

        $roles = [];
        foreach ($keycloakRoles as $name) {
            if (isset($this->mapping[$name])) {
                $roles[] = $this->mapping[$name]->securityRole();
            }
        }

        return array_values(array_unique($roles));
    }

    /**
     * @return list<string>
     */
    private function stringList(mixed $value): array
    {
        return \is_array($value) ? array_values(array_filter($value, 'is_string')) : [];
    }
}
