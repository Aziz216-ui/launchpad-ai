package com.launchpad.lawyer.dto;

import com.launchpad.lawyer.entity.DocumentReview;
import com.launchpad.lawyer.entity.ReviewStatus;

import java.time.LocalDateTime;
import java.util.List;

public record DocumentReviewResponseDto(
        Long id,
        String lawyerId,
        Long clientId,
        String clientName,
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
        if (review == null) return null;

        List<CommentResponseDto> commentDtos = review.getComments() != null
                ? review.getComments().stream().map(CommentResponseDto::fromEntity).toList()
                : List.of();

        List<HistoryResponseDto> historyDtos = review.getHistory() != null
                ? review.getHistory().stream().map(HistoryResponseDto::fromEntity).toList()
                : List.of();

        return new DocumentReviewResponseDto(
                review.getId(),
                review.getLawyerId(),
                review.getClient().getId(),
                review.getClient().getFirstName() + " " + review.getClient().getLastName(),
                review.getDocumentTitle(),
                review.getDocumentType(),
                review.getDocumentUrl(),
                review.getStatus(),
                review.getCreatedAt(),
                review.getUpdatedAt(),
                commentDtos,
                historyDtos
        );
    }
}
