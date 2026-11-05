package com.launchpad.lawyer.message.controller;

import com.launchpad.lawyer.message.dto.MessageRequestDto;
import com.launchpad.lawyer.message.dto.MessageResponseDto;
import com.launchpad.lawyer.message.service.MessageService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping({"/api/lawyer/messages", "/api/lawyer/communication/messages"})
@Tag(name = "Message Management", description = "Endpoints for sending, retrieving, marking as read, and deleting messages with clients.")
@CrossOrigin(origins = "*")
public class MessageController {

    private final MessageService messageService;

    public MessageController(MessageService messageService) {
        this.messageService = messageService;
    }

    @PostMapping
    @Operation(summary = "Send a message", description = "Sends a message to a client.")
    public ResponseEntity<MessageResponseDto> sendMessage(
            @Parameter(description = "Authenticated Lawyer ID")
            @RequestHeader(value = "X-Lawyer-Id", defaultValue = "lawyer-1") String lawyerId,
            @Valid @RequestBody MessageRequestDto requestDto) {
        MessageResponseDto message = messageService.sendMessage(lawyerId, requestDto);
        return new ResponseEntity<>(message, HttpStatus.CREATED);
    }

    @GetMapping
    @Operation(summary = "Retrieve messages", description = "Retrieves messages, optionally filtered by client.")
    public ResponseEntity<List<MessageResponseDto>> getMessages(
            @Parameter(description = "Authenticated Lawyer ID")
            @RequestHeader(value = "X-Lawyer-Id", defaultValue = "lawyer-1") String lawyerId,
            @RequestParam(required = false) Long clientId) {
        if (clientId != null) {
            return ResponseEntity.ok(messageService.getMessagesByClient(lawyerId, clientId));
        }
        return ResponseEntity.ok(messageService.getAllMessages(lawyerId));
    }

    @GetMapping("/{clientId}")
    @Operation(summary = "Retrieve messages with client", description = "Retrieves communication message history with a specific client.")
    public ResponseEntity<List<MessageResponseDto>> getMessagesByClient(
            @Parameter(description = "Authenticated Lawyer ID")
            @RequestHeader(value = "X-Lawyer-Id", defaultValue = "lawyer-1") String lawyerId,
            @PathVariable Long clientId) {
        List<MessageResponseDto> messages = messageService.getMessagesByClient(lawyerId, clientId);
        return ResponseEntity.ok(messages);
    }

    @GetMapping("/detail/{id}")
    @Operation(summary = "Get message by ID", description = "Retrieves a specific message by its unique ID.")
    public ResponseEntity<MessageResponseDto> getMessageById(
            @Parameter(description = "Authenticated Lawyer ID")
            @RequestHeader(value = "X-Lawyer-Id", defaultValue = "lawyer-1") String lawyerId,
            @PathVariable Long id) {
        MessageResponseDto message = messageService.getMessageById(lawyerId, id);
        return ResponseEntity.ok(message);
    }

    @PatchMapping("/{id}/read")
    @Operation(summary = "Mark message as read", description = "Marks a specific message as read.")
    public ResponseEntity<MessageResponseDto> markAsRead(
            @Parameter(description = "Authenticated Lawyer ID")
            @RequestHeader(value = "X-Lawyer-Id", defaultValue = "lawyer-1") String lawyerId,
            @PathVariable Long id) {
        MessageResponseDto message = messageService.markAsRead(lawyerId, id);
        return ResponseEntity.ok(message);
    }

    @GetMapping("/unread-count")
    @Operation(summary = "Count unread messages", description = "Counts unread messages for lawyer or specific client.")
    public ResponseEntity<Map<String, Object>> countUnread(
            @Parameter(description = "Authenticated Lawyer ID")
            @RequestHeader(value = "X-Lawyer-Id", defaultValue = "lawyer-1") String lawyerId,
            @RequestParam(required = false) Long clientId) {
        long count = messageService.countUnreadMessages(lawyerId, clientId);
        return ResponseEntity.ok(Map.of("unreadCount", count));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Delete a message", description = "Deletes a message by its unique ID.")
    public ResponseEntity<Void> deleteMessage(
            @Parameter(description = "Authenticated Lawyer ID")
            @RequestHeader(value = "X-Lawyer-Id", defaultValue = "lawyer-1") String lawyerId,
            @PathVariable Long id) {
        messageService.deleteMessage(lawyerId, id);
        return ResponseEntity.noContent().build();
    }
}

