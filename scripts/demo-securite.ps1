# Démonstration de la sécurité : tout passe par l'API Gateway (http://localhost:8090), protégée par Keycloak.
#   1. sans jeton                       -> 401 Unauthorized
#   2. inscription + connexion          -> jeton JWT émis par Keycloak (realm "launchpad")
#   3. avec le jeton, via la gateway    -> 200 OK (marché, avocat, finance, IA, comptabilité)
#   4. jeton directement auprès de Keycloak (équivalent du client Postman de l'atelier)
# Usage : .\scripts\demo-securite.ps1
$gw = 'http://localhost:8090'
$kc = 'http://localhost:8180'
$user = 'demo' + (Get-Random -Maximum 99999)
$pass = 'Passw0rd!123'

function Appel($label, $url, $token) {
  $h = @{}
  if ($token) { $h['Authorization'] = "Bearer $token" }
  try {
    $r = Invoke-WebRequest -Uri $url -Headers $h -UseBasicParsing -TimeoutSec 20
    Write-Host ("{0,-46} -> {1}" -f $label, $r.StatusCode) -ForegroundColor Green
  } catch {
    $code = if ($_.Exception.Response) { [int]$_.Exception.Response.StatusCode } else { 'ERR' }
    $color = if ($code -eq 401) { 'Yellow' } else { 'Red' }
    Write-Host ("{0,-46} -> {1}" -f $label, $code) -ForegroundColor $color
  }
}

Write-Host "`n== 1. Sans jeton (attendu : 401) ==" -ForegroundColor Cyan
Appel 'GET /api/market/etudes/' "$gw/api/market/etudes/" $null
Appel 'GET /api/lawyer/clients'  "$gw/api/lawyer/clients" $null

Write-Host "`n== 2. Inscription + connexion (User-Service -> Keycloak) ==" -ForegroundColor Cyan
$reg = @{ username = $user; email = "$user@example.com"; password = $pass; role = 'ENTREPRENEUR' } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri "$gw/api/auth/register/" -ContentType 'application/json' -Body $reg | Out-Null
$login = Invoke-RestMethod -Method Post -Uri "$gw/api/auth/login/" -ContentType 'application/json' `
  -Body (@{ username = $user; password = $pass } | ConvertTo-Json)
$token = $login.access_token
Write-Host "Utilisateur $user connecté, jeton reçu ($($token.Length) caractères)"

Write-Host "`n== 3. Avec le jeton, via la gateway (attendu : 200) ==" -ForegroundColor Cyan
Appel 'GET /api/market/etudes/'        "$gw/api/market/etudes/" $token
Appel 'GET /api/market/secteurs/'      "$gw/api/market/secteurs/" $token
Appel 'GET /api/auth/profile/'         "$gw/api/auth/profile/" $token

Write-Host "`n== 4. Jeton directement chez Keycloak (flux password, comme Postman) ==" -ForegroundColor Cyan
$secret = if ($env:KEYCLOAK_CLIENT_SECRET) { $env:KEYCLOAK_CLIENT_SECRET } else { 'launchpad-dev-client-secret' }
$kcTok = Invoke-RestMethod -Method Post -Uri "$kc/realms/launchpad/protocol/openid-connect/token" `
  -Body @{ grant_type = 'password'; client_id = 'launchpad-client'; client_secret = $secret; username = $user; password = $pass }
Appel 'GET /api/market/etudes/ (jeton Keycloak)' "$gw/api/market/etudes/" $kcTok.access_token

Write-Host "`n== 5. Autorisation par rôle : DELETE réservé à ADMIN (Ahmed = ADMIN, Adem = ENTREPRENEUR) ==" -ForegroundColor Cyan
function Connexion($nom, $mdp) {
  (Invoke-RestMethod -Method Post -Uri "$gw/api/auth/login/" -ContentType 'application/json' `
    -Body (@{ username = $nom; password = $mdp } | ConvertTo-Json)).access_token
}
function Suppression($label, $url, $token, $attendu) {
  try {
    $r = Invoke-WebRequest -Method Delete -Uri $url -Headers @{ Authorization = "Bearer $token" } -UseBasicParsing -TimeoutSec 20
    $code = [int]$r.StatusCode
  } catch {
    $code = if ($_.Exception.Response) { [int]$_.Exception.Response.StatusCode } else { 'ERR' }
  }
  # Pour ADMIN, la gateway laisse passer : 204 ou 404 (id inexistant) prouvent que ce n'est pas un 403.
  $ok = if ($attendu -eq 403) { $code -eq 403 } else { $code -ne 403 -and $code -ne 401 }
  Write-Host ("{0,-46} -> {1}" -f $label, $code) -ForegroundColor $(if ($ok) { 'Green' } else { 'Red' })
}
$mdpAdem  = if ($env:DEMO_USER_PASSWORD)  { $env:DEMO_USER_PASSWORD }  else { 'Adem@2026!' }
$mdpAhmed = if ($env:DEMO_ADMIN_PASSWORD) { $env:DEMO_ADMIN_PASSWORD } else { 'Ahmed@2026!' }
$tokAdem  = Connexion 'adem' $mdpAdem
$tokAhmed = Connexion 'ahmed' $mdpAhmed
Suppression 'DELETE étude (Adem, user)  attendu 403'  "$gw/api/market/etudes/00000000/" $tokAdem 403
Suppression 'DELETE étude (Ahmed, admin) attendu != 403' "$gw/api/market/etudes/00000000/" $tokAhmed 200
Write-Host ""
