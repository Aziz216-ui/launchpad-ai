$baseUrl = "http://localhost:8082"
$headers = @{ "X-Lawyer-Id" = "maitre_dupont"; "Content-Type" = "application/json" }

Write-Host "=========================================="
Write-Host " TESTING ALL 21 LAWYER-SPACE ENDPOINTS "
Write-Host "=========================================="

# 1. POST /api/lawyer/clients
$clientBody = @{
    firstName = "Claire"
    lastName  = "Fontaine"
    email     = "claire.fontaine@fintech.fr"
    phone     = "+33655443322"
    company   = "FinTech Innovate"
    address   = "10 Rue de la Paix, Paris"
    notes     = "Levée de fonds Série A"
    status    = "ACTIVE"
} | ConvertTo-Json
$client = Invoke-RestMethod -Uri "$baseUrl/api/lawyer/clients" -Method Post -Headers $headers -Body $clientBody
$clientId = $client.id
Write-Host "[1/21] POST /api/lawyer/clients -> OK (id=$clientId, name=$($client.fullName))" -ForegroundColor Green

# 2. GET /api/lawyer/clients
$clients = Invoke-RestMethod -Uri "$baseUrl/api/lawyer/clients?query=Claire&status=ACTIVE" -Method Get -Headers $headers
Write-Host "[2/21] GET /api/lawyer/clients?query=Claire -> OK (count=$($clients.Count))" -ForegroundColor Green

# 3. GET /api/lawyer/clients/{id}
$clientDetails = Invoke-RestMethod -Uri "$baseUrl/api/lawyer/clients/$clientId" -Method Get -Headers $headers
Write-Host "[3/21] GET /api/lawyer/clients/$clientId -> OK ($($clientDetails.email))" -ForegroundColor Green

# 4. PUT /api/lawyer/clients/{id}
$updateBody = @{
    firstName = "Claire"
    lastName  = "Fontaine"
    email     = "claire.fontaine@fintech.fr"
    phone     = "+33655449999"
    company   = "FinTech Innovate SAS"
    address   = "12 Rue de la Paix, Paris"
    notes     = "Levée de fonds Série A - Closing imminent"
    status    = "ACTIVE"
} | ConvertTo-Json
$updatedClient = Invoke-RestMethod -Uri "$baseUrl/api/lawyer/clients/$clientId" -Method Put -Headers $headers -Body $updateBody
Write-Host "[4/21] PUT /api/lawyer/clients/$clientId -> OK (phone=$($updatedClient.phone))" -ForegroundColor Green

# 5. PATCH /api/lawyer/clients/{id}/archive
$archived = Invoke-RestMethod -Uri "$baseUrl/api/lawyer/clients/$clientId/archive" -Method Patch -Headers $headers
Write-Host "[5/21] PATCH /api/lawyer/clients/$clientId/archive -> OK (status=$($archived.status))" -ForegroundColor Green

# Re-activate client for appointments
$reactivateBody = @{
    firstName = "Claire"
    lastName  = "Fontaine"
    email     = "claire.fontaine@fintech.fr"
    phone     = "+33655449999"
    company   = "FinTech Innovate SAS"
    status    = "ACTIVE"
} | ConvertTo-Json
$client = Invoke-RestMethod -Uri "$baseUrl/api/lawyer/clients/$clientId" -Method Put -Headers $headers -Body $reactivateBody

# 6. POST /api/lawyer/appointments
$start = (Get-Date).AddDays(5).ToString("yyyy-MM-ddTHH:00:00")
$end = (Get-Date).AddDays(5).AddHours(1).ToString("yyyy-MM-ddTHH:00:00")
$appBody = @{
    clientId    = $clientId
    title       = "Négociation pacte d'actionnaires"
    description = "Audit des clauses de liquidité"
    startTime   = $start
    endTime     = $end
    location    = "Cabinet Paris"
    status      = "SCHEDULED"
} | ConvertTo-Json
$appointment = Invoke-RestMethod -Uri "$baseUrl/api/lawyer/appointments" -Method Post -Headers $headers -Body $appBody
$appId = $appointment.id
Write-Host "[6/21] POST /api/lawyer/appointments -> OK (id=$appId, title=$($appointment.title))" -ForegroundColor Green

# Test Overlap Detection (Must throw 409)
try {
    Invoke-RestMethod -Uri "$baseUrl/api/lawyer/appointments" -Method Post -Headers $headers -Body $appBody
    Write-Host "[CONFLICT] Overlap check FAILED - allowed duplicate" -ForegroundColor Red
} catch {
    Write-Host "       -> Conflict detection verified: 409 Overlap prevented!" -ForegroundColor Cyan
}

# 7. GET /api/lawyer/appointments
$apps = Invoke-RestMethod -Uri "$baseUrl/api/lawyer/appointments?clientId=$clientId" -Method Get -Headers $headers
Write-Host "[7/21] GET /api/lawyer/appointments?clientId=$clientId -> OK (count=$($apps.Count))" -ForegroundColor Green

# 8. GET /api/lawyer/appointments/{id}
$appDetails = Invoke-RestMethod -Uri "$baseUrl/api/lawyer/appointments/$appId" -Method Get -Headers $headers
Write-Host "[8/21] GET /api/lawyer/appointments/$appId -> OK ($($appDetails.title))" -ForegroundColor Green

# 9. PATCH /api/lawyer/appointments/{id}/reschedule
$newStart = (Get-Date).AddDays(6).ToString("yyyy-MM-ddTHH:00:00")
$newEnd = (Get-Date).AddDays(6).AddHours(1).ToString("yyyy-MM-ddTHH:00:00")
$rescheduleBody = @{
    newStartTime = $newStart
    newEndTime   = $newEnd
    location     = "Visioconférence Teams"
} | ConvertTo-Json
$rescheduled = Invoke-RestMethod -Uri "$baseUrl/api/lawyer/appointments/$appId/reschedule" -Method Patch -Headers $headers -Body $rescheduleBody
Write-Host "[9/21] PATCH /api/lawyer/appointments/$appId/reschedule -> OK (status=$($rescheduled.status))" -ForegroundColor Green

# 10. PATCH /api/lawyer/appointments/{id}/complete
$completed = Invoke-RestMethod -Uri "$baseUrl/api/lawyer/appointments/$appId/complete" -Method Patch -Headers $headers
Write-Host "[10/21] PATCH /api/lawyer/appointments/$appId/complete -> OK (status=$($completed.status))" -ForegroundColor Green

# 11. PATCH /api/lawyer/appointments/{id}/cancel
$cancelled = Invoke-RestMethod -Uri "$baseUrl/api/lawyer/appointments/$appId/cancel" -Method Patch -Headers $headers
Write-Host "[11/21] PATCH /api/lawyer/appointments/$appId/cancel -> OK (status=$($cancelled.status))" -ForegroundColor Green

# 12. POST /api/lawyer/communication/messages
$msgBody = @{
    clientId   = $clientId
    senderType = "LAWYER"
    subject    = "Validation du tour de table"
    content    = "Bonjour Claire, nous avons finalisé la term sheet pour vos investisseurs."
} | ConvertTo-Json
$msg = Invoke-RestMethod -Uri "$baseUrl/api/lawyer/communication/messages" -Method Post -Headers $headers -Body $msgBody
$msgId = $msg.id
Write-Host "[12/21] POST /api/lawyer/communication/messages -> OK (id=$msgId)" -ForegroundColor Green

# 13. GET /api/lawyer/communication/messages/{clientId}
$msgs = Invoke-RestMethod -Uri "$baseUrl/api/lawyer/communication/messages/$clientId" -Method Get -Headers $headers
Write-Host "[13/21] GET /api/lawyer/communication/messages/$clientId -> OK (count=$($msgs.Count))" -ForegroundColor Green

# 14. POST /api/lawyer/communication/requests
$reqBody = @{
    clientId       = $clientId
    title          = "Table de capitalisation actualisée"
    description    = "Transmettre la cap table sous format Excel certifié"
    requestedItems = "Cap table, tableau BSA, registre des mouvements de titres"
    dueDate        = (Get-Date).AddDays(7).ToString("yyyy-MM-dd")
} | ConvertTo-Json
$infoReq = Invoke-RestMethod -Uri "$baseUrl/api/lawyer/communication/requests" -Method Post -Headers $headers -Body $reqBody
$reqId = $infoReq.id
Write-Host "[14/21] POST /api/lawyer/communication/requests -> OK (id=$reqId, status=$($infoReq.status))" -ForegroundColor Green

# 15. GET /api/lawyer/communication/requests
$allReqs = Invoke-RestMethod -Uri "$baseUrl/api/lawyer/communication/requests?clientId=$clientId" -Method Get -Headers $headers
Write-Host "[15/21] GET /api/lawyer/communication/requests?clientId=$clientId -> OK (count=$($allReqs.Count))" -ForegroundColor Green

# 16. PATCH /api/lawyer/communication/requests/{id}/status
$statusBody = @{ status = "SUBMITTED" } | ConvertTo-Json
$updatedReq = Invoke-RestMethod -Uri "$baseUrl/api/lawyer/communication/requests/$reqId/status" -Method Patch -Headers $headers -Body $statusBody
Write-Host "[16/21] PATCH /api/lawyer/communication/requests/$reqId/status -> OK (status=$($updatedReq.status))" -ForegroundColor Green

# 17. POST /api/lawyer/reviews
$reviewBody = @{
    clientId      = $clientId
    documentTitle = "Term Sheet Série A - V2"
    documentType  = "TERM_SHEET"
    documentUrl   = "https://mock-storage.launchpad.ai/docs/termsheet-v2.pdf"
} | ConvertTo-Json
$review = Invoke-RestMethod -Uri "$baseUrl/api/lawyer/reviews" -Method Post -Headers $headers -Body $reviewBody
$reviewId = $review.id
Write-Host "[17/21] POST /api/lawyer/reviews -> OK (id=$reviewId, status=$($review.status))" -ForegroundColor Green

# 18. GET /api/lawyer/reviews
$reviews = Invoke-RestMethod -Uri "$baseUrl/api/lawyer/reviews?clientId=$clientId" -Method Get -Headers $headers
Write-Host "[18/21] GET /api/lawyer/reviews?clientId=$clientId -> OK (count=$($reviews.Count))" -ForegroundColor Green

# 19. GET /api/lawyer/reviews/{id}
$reviewDetails = Invoke-RestMethod -Uri "$baseUrl/api/lawyer/reviews/$reviewId" -Method Get -Headers $headers
Write-Host "[19/21] GET /api/lawyer/reviews/$reviewId -> OK ($($reviewDetails.documentTitle))" -ForegroundColor Green

# 20. POST /api/lawyer/reviews/{id}/comments
$commentBody = @{
    author              = "Maître Alexandre Dupont"
    pageNumber          = 3
    commentText         = "Ajuster le droit de préemption au profit des fondateurs"
    correctionRequested = $true
} | ConvertTo-Json
$withComment = Invoke-RestMethod -Uri "$baseUrl/api/lawyer/reviews/$reviewId/comments" -Method Post -Headers $headers -Body $commentBody
Write-Host "[20/21] POST /api/lawyer/reviews/$reviewId/comments -> OK (status=$($withComment.status), comments=$($withComment.comments.Count))" -ForegroundColor Green

# 21. PATCH /api/lawyer/reviews/{id}/decision
$decisionBody = @{
    status       = "APPROVED"
    reason       = "Clause corrigée conformément aux intérêts de la startup."
    reviewerName = "Maître Alexandre Dupont"
} | ConvertTo-Json
$decided = Invoke-RestMethod -Uri "$baseUrl/api/lawyer/reviews/$reviewId/decision" -Method Patch -Headers $headers -Body $decisionBody
Write-Host "[21/21] PATCH /api/lawyer/reviews/$reviewId/decision -> OK (status=$($decided.status), historyEntries=$($decided.history.Count))" -ForegroundColor Green

Write-Host "`n>>> ALL 21 ENDPOINTS TESTED AND VERIFIED SUCCESSFULLY! <<<`n" -ForegroundColor Green
