<#
.SYNOPSIS
    Test de bout en bout des 4 microservices de l'étude de marché, via l'API Gateway.

.DESCRIPTION
    Prérequis : Eureka (8761), API Gateway (8090) et "docker compose up -d" de Backend/Market.
    Le script passe uniquement par la gateway et :
      1. vérifie le health check des 4 services ;
      2. crée un secteur, une tendance, un concurrent lié, une étude liée et un persona ;
      3. génère la SWOT, récupère le rapport JSON et PDF, les analyses secteur et projet ;
      4. teste un secteur inexistant (400) et un service arrêté (503, docker stop/start) ;
      5. supprime tout ce qu'il a créé (la SWOT est supprimée de façon asynchrone par
         swot-consumer, à la réception de l'événement RabbitMQ etude.supprimee).
    Code de sortie 0 si tout est vert, 1 sinon.

.EXAMPLE
    cd Backend/Market
    .\test_e2e.ps1
#>
param(
    [string]$Gateway = "http://localhost:8090",
    # Compte de dÃ©mo ADMIN (crÃ©Ã© par User-Service, voir seed_demo_users) : la gateway exige un jeton Keycloak
    # sur toutes les routes mÃ©tier, et le rÃ´le ADMIN pour les DELETE.
    [string]$Utilisateur = "ahmed",
    [string]$MotDePasse = "Ahmed@2026!",
    [switch]$SansArretDeService
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Net.Http
$http = New-Object System.Net.Http.HttpClient
$http.Timeout = [TimeSpan]::FromSeconds(30)
$script:echecs = 0
$script:total = 0
$script:jeton = $null

function Get-Jeton {
    # Connexion via la gateway (User-Service -> Keycloak) ; le jeton est mis en cache pour tout le script.
    if (-not $script:jeton) {
        $login = @{ username = $Utilisateur; password = $MotDePasse } | ConvertTo-Json -Compress
        $req = New-Object System.Net.Http.HttpRequestMessage ([System.Net.Http.HttpMethod]::Post), "$Gateway/api/auth/login/"
        $req.Content = New-Object System.Net.Http.StringContent $login, ([Text.Encoding]::UTF8), "application/json"
        $rep = $http.SendAsync($req).Result
        if ([int]$rep.StatusCode -ne 200) { throw "Connexion impossible pour $Utilisateur (HTTP $([int]$rep.StatusCode))" }
        $script:jeton = (ConvertFrom-Json ($rep.Content.ReadAsStringAsync().Result)).access_token
    }
    return $script:jeton
}

function Invoke-Api([string]$Methode, [string]$Chemin, $Corps = $null) {
    # HttpClient : pas d'exception sur 4xx/5xx, et décodage UTF-8 explicite (PowerShell 5.1 et 7)
    $requete = New-Object System.Net.Http.HttpRequestMessage ([System.Net.Http.HttpMethod]::new($Methode)), "$Gateway$Chemin"
    if (-not $Chemin.StartsWith("/api/auth/") -and -not $Chemin.Contains("/health")) {
        $requete.Headers.Authorization = New-Object System.Net.Http.Headers.AuthenticationHeaderValue "Bearer", (Get-Jeton)
    }
    if ($null -ne $Corps) {
        $json = ConvertTo-Json $Corps -Depth 5 -Compress
        $requete.Content = New-Object System.Net.Http.StringContent $json, ([Text.Encoding]::UTF8), "application/json"
    }
    $reponse = $http.SendAsync($requete).Result
    $octets = $reponse.Content.ReadAsByteArrayAsync().Result
    $type = if ($reponse.Content.Headers.ContentType) { $reponse.Content.Headers.ContentType.MediaType } else { "" }
    $donnees = $null
    if ($type -eq "application/json" -and $octets.Length) {
        $donnees = ConvertFrom-Json ([Text.Encoding]::UTF8.GetString($octets))
    }
    return [pscustomobject]@{ Status = [int]$reponse.StatusCode; Json = $donnees; Octets = $octets; Type = $type }
}

function Test-Etape([string]$Nom, [bool]$Condition, [string]$Detail = "") {
    $script:total++
    if ($Condition) {
        Write-Host "  [OK]    $Nom" -ForegroundColor Green
    } else {
        $script:echecs++
        Write-Host "  [ECHEC] $Nom $Detail" -ForegroundColor Red
    }
}

function Attendre-Condition([scriptblock]$Condition, [int]$Secondes = 20) {
    # Effets asynchrones (consumers RabbitMQ) : on réessaie jusqu'au délai
    $fin = (Get-Date).AddSeconds($Secondes)
    while ((Get-Date) -lt $fin) {
        if (& $Condition) { return $true }
        Start-Sleep -Seconds 1
    }
    return $false
}

function Attendre-Service([string]$Chemin, [int]$Secondes = 90) {
    $fin = (Get-Date).AddSeconds($Secondes)
    while ((Get-Date) -lt $fin) {
        try { if ((Invoke-Api GET $Chemin).Status -eq 200) { return $true } }
        catch { Write-Verbose "Service pas encore joignable ($Chemin) : $($_.Exception.Message)" }
        Start-Sleep -Seconds 2
    }
    return $false
}

$suffixe = Get-Date -Format "yyyyMMddHHmmss"
Write-Host "Test E2E de l'étude de marché via $Gateway" -ForegroundColor Cyan

# --- 1. Health checks ------------------------------------------------------------
Write-Host "`n1. Health checks"
foreach ($s in @(@("secteurs", "secteur-service"), @("concurrents", "concurrent-service"),
                 @("etudes", "etude-service"), @("swot", "swot-service"))) {
    $r = Invoke-Api GET "/api/market/$($s[0])/health/"
    Test-Etape "$($s[1]) UP" ($r.Status -eq 200 -and $r.Json.service -eq $s[1]) "(HTTP $($r.Status))"
}

# --- 2. Création des données liées -------------------------------------------------
Write-Host "`n2. Création (relations vérifiées par appels REST entre services)"
$r = Invoke-Api POST "/api/market/secteurs/" @{ nom = "E2E Santé $suffixe"; description = "Secteur de test E2E" }
Test-Etape "POST secteur -> 201" ($r.Status -eq 201) "(HTTP $($r.Status))"
$secteurId = $r.Json.id

$r = Invoke-Api POST "/api/market/tendances/" @{ titre = "Télémédecine E2E"; secteur = $secteurId; impact = "positif"; description = "En hausse" }
Test-Etape "POST tendance -> 201" ($r.Status -eq 201) "(HTTP $($r.Status))"
$tendanceId = $r.Json.id

$r = Invoke-Api POST "/api/market/concurrents/" @{
    nom = "Concurrent E2E"; secteur_id = $secteurId; pays = "Tunisie"; prix_moyen = 50; part_de_marche = 20
}
Test-Etape "POST concurrent lié -> 201 (secteur vérifié via SECTEUR-SERVICE)" ($r.Status -eq 201) "(HTTP $($r.Status))"
Test-Etape "concurrent.secteur_nom lu sur SECTEUR-SERVICE" ($r.Json.secteur_nom -eq "E2E Santé $suffixe") "($($r.Json.secteur_nom))"
$concurrentId = $r.Json.id

$r = Invoke-Api POST "/api/market/concurrents/" @{ nom = "Orphelin E2E"; secteur_id = 999999 }
Test-Etape "POST concurrent, secteur inexistant -> 400" ($r.Status -eq 400) "(HTTP $($r.Status))"
Test-Etape "message 'Secteur introuvable'" ($r.Json.secteur_id -contains "Secteur introuvable") "($(ConvertTo-Json $r.Json -Compress))"

$r = Invoke-Api POST "/api/market/etudes/" @{
    projet_id = 9001; entrepreneur_id = 501; secteur_id = $secteurId; titre = "Étude E2E $suffixe"
    taille_marche = 1000000; taux_croissance = 15; cible = "Patients"; zone_geographique = "Tunisie"
    description_offre = "Téléconsultation"; prix_propose = 40
    concurrent_ids = @($concurrentId); tendance_ids = @($tendanceId)
}
Test-Etape "POST étude liée -> 201 (secteur, concurrents, tendances vérifiés)" ($r.Status -eq 201) "(HTTP $($r.Status) $(ConvertTo-Json $r.Json -Compress))"
$etudeId = $r.Json.id

$r = Invoke-Api POST "/api/market/etudes/" @{ projet_id = 9001; secteur_id = $secteurId; titre = "X"; concurrent_ids = @(999999) }
Test-Etape "POST étude, concurrent inexistant -> 400" ($r.Status -eq 400) "(HTTP $($r.Status))"

$r = Invoke-Api POST "/api/market/personas/" @{ etude = $etudeId; nom = "Amel, patiente E2E"; tranche_age = "30-40 ans"; revenu_estime = 1800 }
Test-Etape "POST persona -> 201" ($r.Status -eq 201) "(HTTP $($r.Status))"

# --- 3. SWOT, rapport et analyses -------------------------------------------------
Write-Host "`n3. SWOT, rapport et analyses (agrégation entre services)"
$r = Invoke-Api POST "/api/market/swot/" @{ etude_id = $etudeId; type = "force"; description = "Équipe médicale E2E" }
Test-Etape "POST élément SWOT manuel -> 201 (étude vérifiée via ETUDE-SERVICE)" ($r.Status -eq 201) "(HTTP $($r.Status))"

$r = Invoke-Api POST "/api/market/etudes/$etudeId/generer-swot/"
Test-Etape "POST generer-swot -> 200 (SWOT-SERVICE)" ($r.Status -eq 200) "(HTTP $($r.Status))"
Test-Etape "SWOT générée et élément manuel conservé" ($r.Json.generes -gt 0 -and $r.Json.conserves -eq 1) "(generes=$($r.Json.generes), conserves=$($r.Json.conserves))"

$r = Invoke-Api GET "/api/market/etudes/$etudeId/"
Test-Etape "GET détail étude -> concurrents, tendances, personas, SWOT" ($r.Status -eq 200 -and $r.Json.concurrents_details.Count -eq 1 -and $r.Json.tendances_details.Count -eq 1 -and $r.Json.personas.Count -eq 1 -and $r.Json.swot.Count -gt 1) "(HTTP $($r.Status))"

$r = Invoke-Api GET "/api/market/etudes/$etudeId/rapport/"
Test-Etape "GET rapport JSON -> 200" ($r.Status -eq 200) "(HTTP $($r.Status))"
Test-Etape "rapport : secteur, concurrent, SWOT enregistrée, potentiel" ($r.Json.marche_cible.secteur.nom -eq "E2E Santé $suffixe" -and $r.Json.concurrents.Count -eq 1 -and $r.Json.swot.source -eq "enregistree" -and $r.Json.potentiel_commercial.niveau) "($($r.Json.swot.source))"

$r = Invoke-Api GET "/api/market/etudes/$etudeId/rapport/pdf/"
$entete = if ($r.Octets.Length -ge 4) { [Text.Encoding]::ASCII.GetString($r.Octets, 0, 4) } else { "" }
Test-Etape "GET rapport PDF -> 200 application/pdf" ($r.Status -eq 200 -and $r.Type -eq "application/pdf" -and $entete -eq "%PDF") "(HTTP $($r.Status) $($r.Type))"

$r = Invoke-Api GET "/api/market/analyse/secteur/$secteurId/"
Test-Etape "GET analyse secteur -> 1 concurrent (CONCURRENT-SERVICE)" ($r.Status -eq 200 -and $r.Json.nombre_concurrents -eq 1) "(HTTP $($r.Status))"

$r = Invoke-Api GET "/api/market/analyse/projet/9001/"
Test-Etape "GET analyse projet -> 200" ($r.Status -eq 200 -and $r.Json.nombre_etudes -eq 1) "(HTTP $($r.Status))"

$r = Invoke-Api GET "/api/market/analyse/projet/987654/"
Test-Etape "GET analyse projet sans étude -> 200 'inconnu'" ($r.Status -eq 200 -and $r.Json.niveau_concurrence -eq "inconnu") "(HTTP $($r.Status))"

# --- 4. Service arrêté -> 503 -------------------------------------------------------
if (-not $SansArretDeService) {
    Write-Host "`n4. Service arrêté (docker stop secteur-service)"
    docker stop secteur-service | Out-Null
    try {
        $r = Invoke-Api POST "/api/market/concurrents/" @{ nom = "Pendant la panne"; secteur_id = $secteurId }
        Test-Etape "POST concurrent, SECTEUR-SERVICE arrêté -> 503" ($r.Status -eq 503) "(HTTP $($r.Status))"
        Test-Etape "503 JSON {service: SECTEUR-SERVICE, message: Service indisponible}" ($r.Json.service -eq "SECTEUR-SERVICE" -and $r.Json.message -eq "Service indisponible") "($(ConvertTo-Json $r.Json -Compress))"

        $r = Invoke-Api GET "/api/market/secteurs/"
        Test-Etape "GET secteurs via la gateway -> 503 SECTEUR-SERVICE" ($r.Status -eq 503 -and $r.Json.service -eq "SECTEUR-SERVICE") "(HTTP $($r.Status))"

        $r = Invoke-Api GET "/api/market/concurrents/$concurrentId/"
        Test-Etape "GET concurrent toujours disponible (secteur_nom = null)" ($r.Status -eq 200 -and $null -eq $r.Json.secteur_nom) "(HTTP $($r.Status))"
    } finally {
        docker start secteur-service | Out-Null
    }
    Test-Etape "secteur-service redémarré et de nouveau routé par la gateway" (Attendre-Service "/api/market/secteurs/health/" 120)
}

# --- 5. Nettoyage -------------------------------------------------------------------
Write-Host "`n5. Nettoyage"
Test-Etape "DELETE étude -> 204 (personas supprimés, événement etude.supprimee)" ((Invoke-Api DELETE "/api/market/etudes/$etudeId/").Status -eq 204)
$swotVide = Attendre-Condition { $r = Invoke-Api GET "/api/market/swot/?etude=$etudeId"; $r.Status -eq 200 -and @($r.Json).Count -eq 0 }
Test-Etape "SWOT de l'étude supprimée par swot-consumer (RabbitMQ)" $swotVide
Test-Etape "DELETE concurrent -> 204" ((Invoke-Api DELETE "/api/market/concurrents/$concurrentId/").Status -eq 204)
Test-Etape "DELETE secteur -> 204 (tendance supprimée)" ((Invoke-Api DELETE "/api/market/secteurs/$secteurId/").Status -eq 204)
Test-Etape "tendance supprimée en cascade" ((Invoke-Api GET "/api/market/tendances/$tendanceId/").Status -eq 404)

# --- Bilan ------------------------------------------------------------------------
Write-Host ""
if ($script:echecs -eq 0) {
    Write-Host "E2E VERT : $($script:total)/$($script:total) vérifications OK" -ForegroundColor Green
    exit 0
}
Write-Host "E2E ROUGE : $($script:echecs) échec(s) sur $($script:total)" -ForegroundColor Red
exit 1
