package com.launchpad.lawyer.controller;

import com.launchpad.lawyer.dto.ClientRequestDto;
import com.launchpad.lawyer.dto.ClientResponseDto;
import com.launchpad.lawyer.entity.ClientStatus;
import com.launchpad.lawyer.service.ClientService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/lawyer/clients")
@Tag(name = "1. Client Management", description = "Endpoints for creating, viewing, updating, archiving, and searching lawyer clients.")
@CrossOrigin(origins = "*")
public class ClientController {

    private final ClientService clientService;

    public ClientController(ClientService clientService) {
        this.clientService = clientService;
    }

    @PostMapping
    @Operation(summary = "Create a client", description = "Creates a new client associated with the authenticated lawyer.")
    public ResponseEntity<ClientResponseDto> createClient(
            @Parameter(description = "Authenticated Lawyer ID")
            @RequestHeader(value = "X-Lawyer-Id", defaultValue = "lawyer-1") String lawyerId,
            @Valid @RequestBody ClientRequestDto requestDto) {
        ClientResponseDto response = clientService.createClient(lawyerId, requestDto);
        return new ResponseEntity<>(response, HttpStatus.CREATED);
    }

    @GetMapping
    @Operation(summary = "View and search clients", description = "Retrieves all clients for the authenticated lawyer, with optional search query and status filter.")
    public ResponseEntity<List<ClientResponseDto>> getClients(
            @Parameter(description = "Authenticated Lawyer ID")
            @RequestHeader(value = "X-Lawyer-Id", defaultValue = "lawyer-1") String lawyerId,
            @RequestParam(required = false) String query,
            @RequestParam(required = false) ClientStatus status) {
        List<ClientResponseDto> clients = clientService.searchAndFilterClients(lawyerId, query, status);
        return ResponseEntity.ok(clients);
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get client details", description = "Retrieves details of a specific client by ID.")
    public ResponseEntity<ClientResponseDto> getClientById(
            @Parameter(description = "Authenticated Lawyer ID")
            @RequestHeader(value = "X-Lawyer-Id", defaultValue = "lawyer-1") String lawyerId,
            @PathVariable Long id) {
        ClientResponseDto client = clientService.getClientById(lawyerId, id);
        return ResponseEntity.ok(client);
    }

    @PutMapping("/{id}")
    @Operation(summary = "Update client information", description = "Updates details of an existing client.")
    public ResponseEntity<ClientResponseDto> updateClient(
            @Parameter(description = "Authenticated Lawyer ID")
            @RequestHeader(value = "X-Lawyer-Id", defaultValue = "lawyer-1") String lawyerId,
            @PathVariable Long id,
            @Valid @RequestBody ClientRequestDto requestDto) {
        ClientResponseDto updated = clientService.updateClient(lawyerId, id, requestDto);
        return ResponseEntity.ok(updated);
    }

    @PatchMapping("/{id}/archive")
    @Operation(summary = "Archive a client", description = "Marks a client as ARCHIVED.")
    public ResponseEntity<ClientResponseDto> archiveClient(
            @Parameter(description = "Authenticated Lawyer ID")
            @RequestHeader(value = "X-Lawyer-Id", defaultValue = "lawyer-1") String lawyerId,
            @PathVariable Long id) {
        ClientResponseDto archived = clientService.archiveClient(lawyerId, id);
        return ResponseEntity.ok(archived);
    }
}
