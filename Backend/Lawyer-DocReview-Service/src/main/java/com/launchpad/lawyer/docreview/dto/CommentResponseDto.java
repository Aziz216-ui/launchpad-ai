package com.launchpad.lawyer.docreview.dto;

import com.launchpad.lawyer.docreview.entity.ReviewComment;
import java.time.LocalDateTime;

public record CommentResponseDto(
        Long id,
        String author,
        Integer pageNumber,
        String commentText,
        boolean correctionRequested,
        LocalDateTime createdAt
) {
    public static CommentResponseDto fromEntity(ReviewComment comment) {
        return new CommentResponseDto(
                comment.getId(),
                comment.getAuthor(),
                comment.getPageNumber(),
                comment.getCommentText(),
                comment.isCorrectionRequested(),
                comment.getCreatedAt()
        );
    }
}

