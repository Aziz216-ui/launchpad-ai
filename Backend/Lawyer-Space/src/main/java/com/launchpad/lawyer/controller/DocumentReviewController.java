package com.launchpad.lawyer.controller;

import com.launchpad.lawyer.dto.*;
import com.launchpad.lawyer.entity.ReviewStatus;
import com.launchpad.lawyer.service.DocumentReviewService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/lawyer/reviews")
@Tag(name = "4. Document Review", description = "Endpoints for creating review records on mock documents, adding comments, requesting corrections, and tracking review decisions with full history.")
@CrossOrigin(origins = "*")
public class DocumentReviewController {

    private final DocumentReviewService documentReviewService;

    public DocumentReviewController(DocumentReviewService documentReviewService) {
        this.documentReviewService = documentReviewService;
    }

    @PostMapping
    @Operation(summary = "Create document review record", description = "Creates a review record using a mock document URL.")
    public ResponseEntity<DocumentReviewResponseDto> createReview(
            @Parameter(description = "Authenticated Lawyer ID")
            @RequestHeader(value = "X-Lawyer-Id", defaultValue = "lawyer-1") String lawyerId,
            @Valid @RequestBody DocumentReviewRequestDto requestDto) {
        DocumentReviewResponseDto response = documentReviewService.createDocumentReview(lawyerId, requestDto);
        return new ResponseEntity<>(response, HttpStatus.CREATED);
    }

    @GetMapping
    @Operation(summary = "View document reviews", description = "Retrieves document reviews filtered by client ID or status.")
    public ResponseEntity<List<DocumentReviewResponseDto>> getReviews(
            @Parameter(description = "Authenticated Lawyer ID")
            @RequestHeader(value = "X-Lawyer-Id", defaultValue = "lawyer-1") String lawyerId,
            @RequestParam(required = false) Long clientId,
            @RequestParam(required = false) ReviewStatus status) {
        List<DocumentReviewResponseDto> reviews = documentReviewService.getReviews(lawyerId, clientId, status);
        return ResponseEntity.ok(reviews);
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get review details with history", description = "Retrieves review details including comments and full status change history.")
    public ResponseEntity<DocumentReviewResponseDto> getReviewById(
            @Parameter(description = "Authenticated Lawyer ID")
            @RequestHeader(value = "X-Lawyer-Id", defaultValue = "lawyer-1") String lawyerId,
            @PathVariable Long id) {
        DocumentReviewResponseDto review = documentReviewService.getReviewById(lawyerId, id);
        return ResponseEntity.ok(review);
    }

    @PostMapping("/{id}/comments")
    @Operation(summary = "Add comment or request correction", description = "Adds a comment to the document review. If correctionRequested is true, automatically transitions status to NEEDS_CORRECTION.")
    public ResponseEntity<DocumentReviewResponseDto> addComment(
            @Parameter(description = "Authenticated Lawyer ID")
            @RequestHeader(value = "X-Lawyer-Id", defaultValue = "lawyer-1") String lawyerId,
            @PathVariable Long id,
            @Valid @RequestBody AddCommentDto commentDto) {
        DocumentReviewResponseDto updated = documentReviewService.addComment(lawyerId, id, commentDto);
        return ResponseEntity.ok(updated);
    }

    @PatchMapping("/{id}/decision")
    @Operation(summary = "Approve, reject or decide review", description = "Applies decision (APPROVED, REJECTED, NEEDS_CORRECTION) to review and records audit history.")
    public ResponseEntity<DocumentReviewResponseDto> processDecision(
            @Parameter(description = "Authenticated Lawyer ID")
            @RequestHeader(value = "X-Lawyer-Id", defaultValue = "lawyer-1") String lawyerId,
            @PathVariable Long id,
            @Valid @RequestBody ReviewDecisionDto decisionDto) {
        DocumentReviewResponseDto updated = documentReviewService.processDecision(lawyerId, id, decisionDto);
        return ResponseEntity.ok(updated);
    }
}
