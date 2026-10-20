package com.launchpad.lawyer.dto;

import com.launchpad.lawyer.entity.ReviewHistory;
import com.launchpad.lawyer.entity.ReviewStatus;

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
        if (history == null) return null;
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
