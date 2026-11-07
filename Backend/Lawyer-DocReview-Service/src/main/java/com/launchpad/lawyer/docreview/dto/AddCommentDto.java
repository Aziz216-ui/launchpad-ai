package com.launchpad.lawyer.docreview.dto;

import jakarta.validation.constraints.NotBlank;

public record AddCommentDto(
        @NotBlank(message = "Author is required")
        String author,

        Integer pageNumber,

        @NotBlank(message = "Comment text cannot be blank")
        String commentText,

        boolean correctionRequested
) {}

