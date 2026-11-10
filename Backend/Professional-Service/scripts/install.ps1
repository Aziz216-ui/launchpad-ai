# Installe les 4 microservices : dépendances, base de données, migrations et données de démonstration.
# Usage (depuis Backend/Professional-Service) :  .\scripts\install.ps1  [-NoFixtures]
# Prérequis : PHP 8.4+ et Composer dans le PATH, MySQL/MariaDB démarré, .env.local de chaque service renseigné.
param([switch]$NoFixtures)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$services = 'workspace-service', 'client-file-service', 'document-service', 'message-service'

foreach ($service in $services) {
    Write-Host "`n=== $service ===" -ForegroundColor Cyan
    Push-Location (Join-Path $root $service)
    try {
        composer install --no-interaction
        if ($LASTEXITCODE -ne 0) { throw "composer install a échoué ($service)" }
        php bin/console doctrine:database:create --if-not-exists
        php bin/console doctrine:migrations:migrate --no-interaction
        if ($LASTEXITCODE -ne 0) { throw "migrations en échec ($service)" }
        if (-not $NoFixtures) {
            php bin/console doctrine:fixtures:load --no-interaction
        }
        # Déclare les queues RabbitMQ des consommateurs (ignoré si RabbitMQ n'est pas encore démarré)
        php bin/console app:rabbitmq:consume --setup
    }
    finally {
        Pop-Location
    }
}

Write-Host "`nInstallation terminée. Démarrage : .\scripts\start.ps1" -ForegroundColor Green
