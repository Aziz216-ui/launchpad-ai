package com.launchpad.lawyer.dto;

import com.launchpad.lawyer.entity.ReviewStatus;
import jakarta.validation.constraints.NotNull;

public record ReviewDecisionDto(
        @NotNull(message = "Decision status is required (APPROVED, REJECTED, NEEDS_CORRECTION)")
        ReviewStatus status,

        String reason,

        String reviewerName
) {
}
