package com.launchpad.lawyer.docreview.dto;

import com.launchpad.lawyer.docreview.entity.ReviewHistory;
import com.launchpad.lawyer.docreview.entity.ReviewStatus;
import java.time.LocalDateTime;

public record HistoryResponseDto(
        Long id,
        ReviewStatus oldStatus,
        ReviewStatus newStatus,
        String changedBy,
        String reason,
        LocalDateTime timestamp
) {
    public static HistoryResponseDto fromEntity(ReviewHistory history) {
        return new HistoryResponseDto(
                history.getId(),
                history.getOldStatus(),
                history.getNewStatus(),
                history.getChangedBy(),
                history.getReason(),
                history.getTimestamp()
        );
    }
}

