package com.launchpad.lawyer.inforequest.controller;

import com.launchpad.lawyer.inforequest.dto.InformationRequestDto;
import com.launchpad.lawyer.inforequest.dto.InformationRequestResponseDto;
import com.launchpad.lawyer.inforequest.dto.UpdateRequestStatusDto;
import com.launchpad.lawyer.inforequest.entity.RequestStatus;
import com.launchpad.lawyer.inforequest.service.InformationRequestService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping({"/api/lawyer/requests", "/api/lawyer/information-requests", "/api/lawyer/communication/requests"})
@Tag(name = "Information Request Management", description = "Endpoints for creating, viewing, updating status, and deleting client information/document requests.")
@CrossOrigin(origins = "*")
public class InformationRequestController {

    private final InformationRequestService informationRequestService;

    public InformationRequestController(InformationRequestService informationRequestService) {
        this.informationRequestService = informationRequestService;
    }

    @PostMapping
    @Operation(summary = "Request missing information/document", description = "Creates a request for missing information or documentation from a client.")
    public ResponseEntity<InformationRequestResponseDto> createRequest(
            @Parameter(description = "Authenticated Lawyer ID")
            @RequestHeader(value = "X-Lawyer-Id", defaultValue = "lawyer-1") String lawyerId,
            @Valid @RequestBody InformationRequestDto requestDto) {
        InformationRequestResponseDto response = informationRequestService.createInformationRequest(lawyerId, requestDto);
        return new ResponseEntity<>(response, HttpStatus.CREATED);
    }

    @GetMapping
    @Operation(summary = "Track requests", description = "Retrieves information and document requests, with optional client or status filter.")
    public ResponseEntity<List<InformationRequestResponseDto>> getRequests(
            @Parameter(description = "Authenticated Lawyer ID")
            @RequestHeader(value = "X-Lawyer-Id", defaultValue = "lawyer-1") String lawyerId,
            @RequestParam(required = false) Long clientId,
            @RequestParam(required = false) RequestStatus status) {
        List<InformationRequestResponseDto> requests = informationRequestService.getInformationRequests(lawyerId, clientId, status);
        return ResponseEntity.ok(requests);
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get request by ID", description = "Retrieves details of a specific information request.")
    public ResponseEntity<InformationRequestResponseDto> getRequestById(
            @Parameter(description = "Authenticated Lawyer ID")
            @RequestHeader(value = "X-Lawyer-Id", defaultValue = "lawyer-1") String lawyerId,
            @PathVariable Long id) {
        InformationRequestResponseDto request = informationRequestService.getInformationRequestById(lawyerId, id);
        return ResponseEntity.ok(request);
    }

    @PatchMapping("/{id}/status")
    @Operation(summary = "Update request status", description = "Updates the status of an information or document request (PENDING, SUBMITTED, APPROVED, REJECTED).")
    public ResponseEntity<InformationRequestResponseDto> updateRequestStatus(
            @Parameter(description = "Authenticated Lawyer ID")
            @RequestHeader(value = "X-Lawyer-Id", defaultValue = "lawyer-1") String lawyerId,
            @PathVariable Long id,
            @Valid @RequestBody UpdateRequestStatusDto statusDto) {
        InformationRequestResponseDto updated = informationRequestService.updateInformationRequestStatus(lawyerId, id, statusDto.status());
        return ResponseEntity.ok(updated);
    }

    @PutMapping("/{id}")
    @Operation(summary = "Update request details", description = "Updates title, description, or requested items for an existing request.")
    public ResponseEntity<InformationRequestResponseDto> updateRequest(
            @Parameter(description = "Authenticated Lawyer ID")
            @RequestHeader(value = "X-Lawyer-Id", defaultValue = "lawyer-1") String lawyerId,
            @PathVariable Long id,
            @Valid @RequestBody InformationRequestDto requestDto) {
        InformationRequestResponseDto updated = informationRequestService.updateInformationRequest(lawyerId, id, requestDto);
        return ResponseEntity.ok(updated);
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Delete request", description = "Deletes an information request by ID.")
    public ResponseEntity<Void> deleteRequest(
            @Parameter(description = "Authenticated Lawyer ID")
            @RequestHeader(value = "X-Lawyer-Id", defaultValue = "lawyer-1") String lawyerId,
            @PathVariable Long id) {
        informationRequestService.deleteInformationRequest(lawyerId, id);
        return ResponseEntity.noContent().build();
    }
}

