package com.launchpad.lawyer.docreview.dto;

import com.launchpad.lawyer.docreview.entity.DocumentReview;
import com.launchpad.lawyer.docreview.entity.ReviewStatus;
import java.time.LocalDateTime;
import java.util.List;

public record DocumentReviewResponseDto(
        Long id,
        String lawyerId,
        Long clientId,
        String clientName,
        String clientEmail,
        String documentTitle,
        String documentType,
        String documentUrl,
        ReviewStatus status,
        LocalDateTime createdAt,
        LocalDateTime updatedAt,
        List<CommentResponseDto> comments,
        List<HistoryResponseDto> history
) {
    public static DocumentReviewResponseDto fromEntity(DocumentReview review) {
        List<CommentResponseDto> comments = review.getComments() != null
                ? review.getComments().stream().map(CommentResponseDto::fromEntity).toList()
                : List.of();

        List<HistoryResponseDto> history = review.getHistory() != null
                ? review.getHistory().stream().map(HistoryResponseDto::fromEntity).toList()
                : List.of();

        return new DocumentReviewResponseDto(
                review.getId(),
                review.getLawyerId(),
                review.getClientId(),
                review.getClientName(),
                review.getClientEmail(),
                review.getDocumentTitle(),
                review.getDocumentType(),
                review.getDocumentUrl(),
                review.getStatus(),
                review.getCreatedAt(),
                review.getUpdatedAt(),
                comments,
                history
        );
    }
}

