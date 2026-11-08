# Lance tous les services Legal (chacun dans sa propre fenêtre PowerShell)
#   .\start-all.ps1              -> avec Eureka
#   .\start-all.ps1 -NoEureka    -> sans Eureka (gateway en profil local)
#   .\start-all.ps1 -NoRabbitMQ  -> sans RabbitMQ (pas d'evenements asynchrones)
#   .\start-all.ps1 -Install     -> fait aussi npm install avant
param(
  [switch]$NoEureka,
  [switch]$NoRabbitMQ,
  [switch]$Install
)

$root = $PSScriptRoot

function Start-Service-Window($name, $folder, $command) {
  $path = Join-Path $root $folder
  $full = "`$Host.UI.RawUI.WindowTitle = '$name'; Set-Location '$path'; $command"
  # Commande encodee : evite les problemes de guillemets et d'espaces dans le chemin
  $encoded = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($full))
  Start-Process powershell -ArgumentList '-NoExit', '-EncodedCommand', $encoded
  Write-Host "-> $name demarre ($folder)" -ForegroundColor Green
}

$nodeServices = @('Clause-Service', 'Commentaire-Service', 'Legal-Service')

if ($Install) {
  foreach ($svc in $nodeServices) {
    Write-Host "npm install dans $svc..." -ForegroundColor Cyan
    Push-Location (Join-Path $root $svc)
    npm install
    Pop-Location
  }
}

$envPrefix = ''
if ($NoEureka) {
  $envPrefix = "`$env:EUREKA_ENABLED='false'; "
}
else {
  Start-Service-Window 'Eureka (8761)' 'Eureka' '.\mvnw.cmd spring-boot:run'
  Write-Host 'Attente du demarrage de Eureka (20 s)...' -ForegroundColor Yellow
  Start-Sleep -Seconds 20
}

if ($NoRabbitMQ) {
  $envPrefix += "`$env:RABBITMQ_ENABLED='false'; "
}
else {
  # Conteneur Docker ; les services se reconnectent seuls s'il n'est pas encore pret
  Write-Host 'Demarrage de RabbitMQ (docker compose)...' -ForegroundColor Cyan
  docker compose -f (Join-Path $root 'RabbitMQ\docker-compose.yml') up -d
}

# Clause et Commentaire d'abord : Legal-Service les appelle
Start-Service-Window 'Clause-Service (3004)' 'Clause-Service' "${envPrefix}npm run start:dev"
Start-Service-Window 'Commentaire-Service (3005)' 'Commentaire-Service' "${envPrefix}npm run start:dev"
Start-Sleep -Seconds 5
Start-Service-Window 'Legal-Service (3003)' 'Legal-Service' "${envPrefix}npm run start:dev"

if ($NoEureka) {
  Start-Service-Window 'API-Gateway (8090)' 'API-Gateway' '.\mvnw.cmd spring-boot:run "-Dspring-boot.run.profiles=local"'
}
else {
  Start-Service-Window 'API-Gateway (8090)' 'API-Gateway' '.\mvnw.cmd spring-boot:run'
}

Write-Host ''
Write-Host 'Tous les services sont lances. URLs utiles :' -ForegroundColor Cyan
if (-not $NoEureka) { Write-Host '  Eureka    : http://localhost:8761' }
if (-not $NoRabbitMQ) { Write-Host '  RabbitMQ  : http://localhost:15672 (guest / guest)' }
Write-Host '  Legal     : http://localhost:3003/api/legal/docs'
Write-Host '  Clauses   : http://localhost:3004/api/clauses/docs'
Write-Host '  Comments  : http://localhost:3005/api/commentaires/docs'
Write-Host '  Gateway   : http://localhost:8090/api/legal/documents'
