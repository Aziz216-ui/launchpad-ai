<#
.SYNOPSIS
    Seed des 4 microservices de l'étude de marché (Docker), dans l'ordre :
    secteurs -> concurrents -> études -> SWOT.

.DESCRIPTION
    Chaque service a sa propre base : les ids des secteurs, concurrents, tendances et
    études ne sont connus qu'après insertion. Le script lit donc les ids réels sur
    l'API de chaque service, les écrit dans un fichier JSON, le copie dans le conteneur
    suivant (docker cp) et lance sa commande de seed avec --ids.

    Résultat : les mêmes données de démonstration que l'ancien Market-Service
    (FinTech, EdTech, HealthTech, 10 concurrents, 7 tendances, 4 études des projets 1, 2 et 3,
    3 personas, SWOT des deux études complètes).

.PARAMETER Reset
    Vide les données de chaque service avant l'insertion.

.EXAMPLE
    cd Backend/Market
    docker compose up -d --build
    .\seed_all.ps1
#>
param(
    [switch]$Reset,
    [string]$SecteurUrl = "http://localhost:8010",
    [string]$ConcurrentUrl = "http://localhost:8011",
    [string]$EtudeUrl = "http://localhost:8012"
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Net.Http
$http = New-Object System.Net.Http.HttpClient
$http.Timeout = [TimeSpan]::FromSeconds(30)

function Get-Json([string]$Url) {
    # Lecture en octets puis décodage UTF-8 (Windows PowerShell 5.1 décode mal les accents sinon)
    $reponse = $http.GetAsync($Url).Result
    if (-not $reponse.IsSuccessStatusCode) { throw "GET $Url -> HTTP $([int]$reponse.StatusCode)" }
    $texte = [Text.Encoding]::UTF8.GetString($reponse.Content.ReadAsByteArrayAsync().Result)
    return ConvertFrom-Json $texte
}

function Invoke-Seed([string]$Conteneur, [string]$Commande, [hashtable]$Ids) {
    $arguments = @("exec", $Conteneur, "python", "manage.py", $Commande)
    if ($Ids) {
        # Fichier JSON UTF-8 sans BOM, copié dans le conteneur
        $fichier = Join-Path ([IO.Path]::GetTempPath()) "market-ids-$Conteneur.json"
        [IO.File]::WriteAllText($fichier, (ConvertTo-Json $Ids -Depth 5), (New-Object Text.UTF8Encoding $false))
        docker cp $fichier "${Conteneur}:/tmp/ids.json" | Out-Null
        if ($LASTEXITCODE -ne 0) { throw "docker cp vers $Conteneur impossible" }
        Remove-Item $fichier
        $arguments += @("--ids", "/tmp/ids.json")
    }
    if ($Reset) { $arguments += "--reset" }
    Write-Host "`n> docker $($arguments -join ' ')" -ForegroundColor Cyan
    & docker @arguments
    if ($LASTEXITCODE -ne 0) { throw "$Commande a échoué dans $Conteneur" }
}

function ConvertTo-Map($Objets, [scriptblock]$Cle) {
    $map = @{}
    foreach ($o in $Objets) { $map[(& $Cle $o)] = [int]$o.id }
    return $map
}

# 1. Secteurs et tendances (aucune dépendance)
Invoke-Seed "secteur-service" "seed_secteurs" $null
$ids = @{
    secteurs  = ConvertTo-Map (Get-Json "$SecteurUrl/api/market/secteurs/") { param($s) $s.nom }
    tendances = ConvertTo-Map (Get-Json "$SecteurUrl/api/market/tendances/") { param($t) $t.titre }
}
Write-Host "Secteurs : $(($ids.secteurs.GetEnumerator() | Sort-Object Name | ForEach-Object { "$($_.Name)=$($_.Value)" }) -join ', ')"

# 2. Concurrents (ids réels des secteurs)
Invoke-Seed "concurrent-service" "seed_concurrents" @{ secteurs = $ids.secteurs }
$ids.concurrents = ConvertTo-Map (Get-Json "$ConcurrentUrl/api/market/concurrents/") { param($c) $c.nom }
Write-Host "Concurrents : $($ids.concurrents.Count)"

# 3. Études et personas (ids réels des secteurs, concurrents et tendances)
Invoke-Seed "etude-service" "seed_etudes" $ids
$etudes = ConvertTo-Map (Get-Json "$EtudeUrl/api/market/etudes/") { param($e) "$($e.projet_id)|$($e.titre)" }
Write-Host "Études : $(($etudes.GetEnumerator() | Sort-Object Name | ForEach-Object { "$($_.Name)=$($_.Value)" }) -join ', ')"

# 4. SWOT (ids réels des études ; la génération appelle ETUDE-SERVICE)
Invoke-Seed "swot-service" "seed_swot" @{ etudes = $etudes }

Write-Host "`nSeed terminé. Analyse du projet 1 : $EtudeUrl/api/market/analyse/projet/1/" -ForegroundColor Green
