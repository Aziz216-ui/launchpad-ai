package com.launchpad.lawyer.controller;

import com.launchpad.lawyer.dto.*;
import com.launchpad.lawyer.entity.RequestStatus;
import com.launchpad.lawyer.service.CommunicationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/lawyer/communication")
@Tag(name = "3. Client Communication", description = "Endpoints for messaging clients and requesting missing information or documents.")
@CrossOrigin(origins = "*")
public class CommunicationController {

    private final CommunicationService communicationService;

    public CommunicationController(CommunicationService communicationService) {
        this.communicationService = communicationService;
    }

    @PostMapping("/messages")
    @Operation(summary = "Send a message", description = "Sends a message to a client.")
    public ResponseEntity<MessageResponseDto> sendMessage(
            @Parameter(description = "Authenticated Lawyer ID")
            @RequestHeader(value = "X-Lawyer-Id", defaultValue = "lawyer-1") String lawyerId,
            @Valid @RequestBody MessageRequestDto requestDto) {
        MessageResponseDto message = communicationService.sendMessage(lawyerId, requestDto);
        return new ResponseEntity<>(message, HttpStatus.CREATED);
    }

    @GetMapping("/messages/{clientId}")
    @Operation(summary = "Retrieve messages with client", description = "Retrieves communication message history with a specific client.")
    public ResponseEntity<List<MessageResponseDto>> getMessages(
            @Parameter(description = "Authenticated Lawyer ID")
            @RequestHeader(value = "X-Lawyer-Id", defaultValue = "lawyer-1") String lawyerId,
            @PathVariable Long clientId) {
        List<MessageResponseDto> messages = communicationService.getMessagesByClient(lawyerId, clientId);
        return ResponseEntity.ok(messages);
    }

    @PostMapping("/requests")
    @Operation(summary = "Request missing information/document", description = "Creates a request for missing information or documentation from a client.")
    public ResponseEntity<InformationRequestResponseDto> createRequest(
            @Parameter(description = "Authenticated Lawyer ID")
            @RequestHeader(value = "X-Lawyer-Id", defaultValue = "lawyer-1") String lawyerId,
            @Valid @RequestBody InformationRequestDto requestDto) {
        InformationRequestResponseDto response = communicationService.createInformationRequest(lawyerId, requestDto);
        return new ResponseEntity<>(response, HttpStatus.CREATED);
    }

    @GetMapping("/requests")
    @Operation(summary = "Track requests", description = "Retrieves information and document requests, with optional client or status filter.")
    public ResponseEntity<List<InformationRequestResponseDto>> getRequests(
            @Parameter(description = "Authenticated Lawyer ID")
            @RequestHeader(value = "X-Lawyer-Id", defaultValue = "lawyer-1") String lawyerId,
            @RequestParam(required = false) Long clientId,
            @RequestParam(required = false) RequestStatus status) {
        List<InformationRequestResponseDto> requests = communicationService.getInformationRequests(lawyerId, clientId, status);
        return ResponseEntity.ok(requests);
    }

    @PatchMapping("/requests/{id}/status")
    @Operation(summary = "Update request status", description = "Updates the status of an information or document request (PENDING, SUBMITTED, APPROVED, REJECTED).")
    public ResponseEntity<InformationRequestResponseDto> updateRequestStatus(
            @Parameter(description = "Authenticated Lawyer ID")
            @RequestHeader(value = "X-Lawyer-Id", defaultValue = "lawyer-1") String lawyerId,
            @PathVariable Long id,
            @Valid @RequestBody UpdateRequestStatusDto statusDto) {
        InformationRequestResponseDto updated = communicationService.updateInformationRequestStatus(lawyerId, id, statusDto.status());
        return ResponseEntity.ok(updated);
    }
}
