package com.launchpad.lawyer.docreview.dto;

import com.launchpad.lawyer.docreview.entity.ReviewStatus;
import jakarta.validation.constraints.NotNull;

public record ReviewDecisionDto(
        @NotNull(message = "Status is required")
        ReviewStatus status,

        String reason,
        String reviewerName
) {}

