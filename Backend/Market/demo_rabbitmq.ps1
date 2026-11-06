<#
.SYNOPSIS
    Démonstration de la communication asynchrone (RabbitMQ) entre les microservices du marché.

.DESCRIPTION
    Prérequis : Eureka (8761), API Gateway (8090) et "docker compose up -d" de Backend/Market
    (RabbitMQ + consumers). Les appels métier passent par la gateway ; le nombre de messages
    d'une queue est lu sur l'API de management de RabbitMQ (http://localhost:15672).

      1. Créer une étude et la finaliser -> etude.finalisee -> swot-consumer génère la SWOT.
      2. Arrêter swot-consumer, supprimer l'étude -> etude.supprimee reste dans la queue
         swot.etude-supprimee (message en attente).
      3. Redémarrer swot-consumer -> la queue se vide et la SWOT de l'étude est supprimée.
      4. Supprimer un secteur -> secteur.supprime -> ses concurrents et études ont secteur_id = null.
      5. Nettoyage.

    -Pause attend Entrée entre les étapes (pour les captures d'écran).
    Code de sortie 0 si toutes les vérifications sont vertes, 1 sinon.

.EXAMPLE
    cd Backend/Market
    .\demo_rabbitmq.ps1 -Pause
#>
param(
    [string]$Gateway = "http://localhost:8090",
    [string]$Management = "http://localhost:15672",
    [string]$RabbitUser = $(if ($env:RABBITMQ_USER) { $env:RABBITMQ_USER } else { "market" }),
    [string]$RabbitPassword = $(if ($env:RABBITMQ_PASSWORD) { $env:RABBITMQ_PASSWORD } else { "market" }),
    [switch]$Pause
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Net.Http
$http = New-Object System.Net.Http.HttpClient
$http.Timeout = [TimeSpan]::FromSeconds(30)
$script:echecs = 0
$script:total = 0
$QueueSuppression = "swot.etude-supprimee"

function Invoke-Api([string]$Methode, [string]$Url, $Corps = $null, [switch]$Management) {
    # HttpClient : pas d'exception sur 4xx/5xx, décodage UTF-8 explicite (PowerShell 5.1 et 7)
    $requete = New-Object System.Net.Http.HttpRequestMessage ([System.Net.Http.HttpMethod]::new($Methode)), $Url
    if ($Management) {
        $jeton = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("${RabbitUser}:${RabbitPassword}"))
        $requete.Headers.Authorization = New-Object System.Net.Http.Headers.AuthenticationHeaderValue "Basic", $jeton
    }
    if ($null -ne $Corps) {
        $json = ConvertTo-Json $Corps -Depth 5 -Compress
        $requete.Content = New-Object System.Net.Http.StringContent $json, ([Text.Encoding]::UTF8), "application/json"
    }
    $reponse = $http.SendAsync($requete).Result
    $texte = [Text.Encoding]::UTF8.GetString($reponse.Content.ReadAsByteArrayAsync().Result)
    $donnees = if ($texte -and $texte.TrimStart().StartsWith("{") -or $texte.TrimStart().StartsWith("[")) { ConvertFrom-Json $texte } else { $null }
    return [pscustomobject]@{ Status = [int]$reponse.StatusCode; Json = $donnees }
}

function Api([string]$Methode, [string]$Chemin, $Corps = $null) { Invoke-Api $Methode "$Gateway$Chemin" $Corps }

function Get-Queue([string]$Nom) {
    # Liste complète puis filtre : l'URL /api/queues/%2F/<nom> est mal décodée par .NET Framework
    $r = Invoke-Api GET "$Management/api/queues" -Management
    if ($r.Status -ne 200) { throw "API de management RabbitMQ : HTTP $($r.Status)" }
    return @($r.Json) | Where-Object { $_.name -eq $Nom } | Select-Object -First 1
}

function Attendre([scriptblock]$Condition, [int]$Secondes = 30) {
    $fin = (Get-Date).AddSeconds($Secondes)
    while ((Get-Date) -lt $fin) {
        if (& $Condition) { return $true }
        Start-Sleep -Seconds 1
    }
    return $false
}

function Test-Etape([string]$Nom, [bool]$Condition, [string]$Detail = "") {
    $script:total++
    if ($Condition) { Write-Host "  [OK]    $Nom" -ForegroundColor Green }
    else { $script:echecs++; Write-Host "  [ECHEC] $Nom $Detail" -ForegroundColor Red }
}

function Etape([string]$Titre) {
    if ($Pause) { Read-Host "`nEntrée pour continuer" | Out-Null }
    Write-Host "`n$Titre" -ForegroundColor Cyan
}

function Logs-Consumer([string]$Conteneur, [int]$Lignes = 3) {
    # Les logs Python sortent sur stderr : sans "Continue", PowerShell 5.1 les traite comme des erreurs
    $ErrorActionPreference = "Continue"
    docker logs $Conteneur --tail 30 2>&1 | ForEach-Object { "$_" } | Where-Object { $_ -match "\[CONSUMER\].*->" } |
        Select-Object -Last $Lignes | ForEach-Object { Write-Host "    $Conteneur | $_" -ForegroundColor DarkGray }
}

function Nombre-Swot([int]$EtudeId) {
    $r = Api GET "/api/market/swot/?etude=$EtudeId"
    return @($r.Json).Count
}

$suffixe = Get-Date -Format "yyyyMMddHHmmss"
Write-Host "Démo RabbitMQ (exchange market.events) via $Gateway — interface : $Management" -ForegroundColor Cyan

# --- 1. Finalisation -> SWOT générée par swot-consumer ---------------------------------
Etape "1. Créer une étude et la finaliser (etude.finalisee -> swot-consumer)"
$secteurId = (Api POST "/api/market/secteurs/" @{ nom = "Démo RabbitMQ $suffixe" }).Json.id
$concurrentId = (Api POST "/api/market/concurrents/" @{ nom = "Concurrent démo"; secteur_id = $secteurId; prix_moyen = 50; part_de_marche = 20 }).Json.id
$r = Api POST "/api/market/etudes/" @{
    projet_id = 9100; secteur_id = $secteurId; titre = "Étude démo RabbitMQ $suffixe"; taux_croissance = 12
    description_offre = "Offre de démonstration"; prix_propose = 40; concurrent_ids = @($concurrentId)
}
Test-Etape "étude créée (id $($r.Json.id))" ($r.Status -eq 201) "(HTTP $($r.Status))"
$etudeId = $r.Json.id
Test-Etape "aucune SWOT avant la finalisation" ((Nombre-Swot $etudeId) -eq 0)

$r = Api POST "/api/market/etudes/$etudeId/finaliser/"
Test-Etape "POST finaliser -> 200 (statut $($r.Json.statut))" ($r.Status -eq 200)
$genere = Attendre { (Nombre-Swot $etudeId) -gt 0 } 30
Test-Etape "SWOT générée par swot-consumer quelques secondes plus tard ($(Nombre-Swot $etudeId) élément(s))" $genere
Logs-Consumer "swot-consumer" 1

# --- 2. Consumer arrêté : le message attend dans la queue ------------------------------
Etape "2. Arrêter swot-consumer puis supprimer l'étude (etude.supprimee reste dans la queue)"
docker stop swot-consumer | Out-Null
Write-Host "  docker stop swot-consumer"
$r = Api DELETE "/api/market/etudes/$etudeId/"
Test-Etape "DELETE étude -> 204 (réponse immédiate, sans attendre SWOT-SERVICE)" ($r.Status -eq 204) "(HTTP $($r.Status))"
$enAttente = Attendre { $q = Get-Queue $QueueSuppression; $q -and $q.messages -ge 1 } 30
$q = Get-Queue $QueueSuppression
Test-Etape "queue $QueueSuppression : $($q.messages) message(s) en attente, $($q.consumers) consumer" ($enAttente -and $q.consumers -eq 0)
Test-Etape "la SWOT de l'étude existe toujours ($(Nombre-Swot $etudeId) élément(s))" ((Nombre-Swot $etudeId) -gt 0)
Write-Host "  -> $Management/#/queues/%2F/$QueueSuppression" -ForegroundColor DarkGray

# --- 3. Consumer redémarré : la queue se vide ------------------------------------------
Etape "3. Redémarrer swot-consumer (le message est consommé, la SWOT est supprimée)"
docker start swot-consumer | Out-Null
Write-Host "  docker start swot-consumer"
$vide = Attendre { $q = Get-Queue $QueueSuppression; (Nombre-Swot $etudeId) -eq 0 -and $q.messages -eq 0 } 60
$q = Get-Queue $QueueSuppression
Test-Etape "queue $QueueSuppression vidée ($($q.messages) message, $($q.consumers) consumer)" ($vide -and $q.messages -eq 0)
Test-Etape "SWOT de l'étude supprimée ($(Nombre-Swot $etudeId) élément)" ((Nombre-Swot $etudeId) -eq 0)
Logs-Consumer "swot-consumer" 2

# --- 4. Suppression d'un secteur -------------------------------------------------------
Etape "4. Supprimer le secteur (secteur.supprime -> concurrent-consumer et etude-consumer)"
$etude2Id = (Api POST "/api/market/etudes/" @{ projet_id = 9100; secteur_id = $secteurId; titre = "Étude liée au secteur $suffixe" }).Json.id
Test-Etape "concurrent et étude liés au secteur $secteurId" (((Api GET "/api/market/concurrents/$concurrentId/").Json.secteur_id -eq $secteurId) -and ((Api GET "/api/market/etudes/$etude2Id/").Json.secteur_id -eq $secteurId))
$r = Api DELETE "/api/market/secteurs/$secteurId/"
Test-Etape "DELETE secteur -> 204" ($r.Status -eq 204) "(HTTP $($r.Status))"
$concurrentNull = Attendre { $null -eq (Api GET "/api/market/concurrents/$concurrentId/").Json.secteur_id } 30
Test-Etape "concurrent $concurrentId : secteur_id = null (concurrent-consumer)" $concurrentNull
$etudeNull = Attendre { $null -eq (Api GET "/api/market/etudes/$etude2Id/").Json.secteur_id } 30
Test-Etape "étude $etude2Id : secteur_id = null (etude-consumer)" $etudeNull
Logs-Consumer "concurrent-consumer" 1
Logs-Consumer "etude-consumer" 1

# --- 5. Nettoyage ------------------------------------------------------------------------
Etape "5. Nettoyage"
Test-Etape "DELETE étude liée -> 204" ((Api DELETE "/api/market/etudes/$etude2Id/").Status -eq 204)
Test-Etape "DELETE concurrent -> 204" ((Api DELETE "/api/market/concurrents/$concurrentId/").Status -eq 204)
$dlq = Get-Queue "market.dlq"
Write-Host "  market.dlq : $($dlq.messages) message(s) en échec"

Write-Host ""
if ($script:echecs -eq 0) {
    Write-Host "DÉMO VERTE : $($script:total)/$($script:total) vérifications OK" -ForegroundColor Green
    exit 0
}
Write-Host "DÉMO ROUGE : $($script:echecs) échec(s) sur $($script:total)" -ForegroundColor Red
exit 1
