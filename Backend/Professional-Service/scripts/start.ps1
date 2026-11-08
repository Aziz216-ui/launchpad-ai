# Démarre les 4 microservices et les 2 consommateurs RabbitMQ, chacun dans sa propre fenêtre PowerShell.
# Prérequis : MySQL/MariaDB et RabbitMQ démarrés (rabbitmq-service start).
# Usage (depuis Backend/Professional-Service) :  .\scripts\start.ps1
$root = Split-Path -Parent $PSScriptRoot

function Start-Window([string]$title, [string]$directory, [string]$command) {
    Start-Process powershell -WorkingDirectory $directory -ArgumentList '-NoExit', '-Command', "`$host.UI.RawUI.WindowTitle = '$title'; $command"
}

# 1. Consommateurs RabbitMQ en premier : ils déclarent leurs queues (comme le service Candidat de l'atelier)
$consumers = 'client-file-service', 'message-service'
foreach ($service in $consumers) {
    Start-Window "$service (RabbitMQ)" (Join-Path $root $service) 'php bin/console app:rabbitmq:consume'
    Write-Host ("{0,-20} consommateur RabbitMQ" -f $service)
}
Start-Sleep -Seconds 3

# 2. Les API HTTP
$services = [ordered]@{
    'workspace-service'   = 8091
    'client-file-service' = 8092
    'document-service'    = 8093
    'message-service'     = 8094
}
foreach ($service in $services.Keys) {
    Start-Window $service (Join-Path $root $service) 'composer serve'
    Write-Host ("{0,-20} http://127.0.0.1:{1}/api/comptable/docs" -f $service, $services[$service])
}

Write-Host "`nInterface RabbitMQ : http://localhost:15672 (guest / guest)"
Write-Host "Fermez une fenêtre (ou Ctrl+C) pour arrêter le processus correspondant."
