package com.launchpad.lawyer.dto;

import jakarta.validation.constraints.NotBlank;

public record AddCommentDto(
        @NotBlank(message = "Author is required")
        String author,

        Integer pageNumber,

        @NotBlank(message = "Comment text is required")
        String commentText,

        boolean correctionRequested
) {
}
