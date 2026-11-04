package com.launchpad.prevision.dto;

import com.launchpad.prevision.service.ia.AssistantFinancier;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record QuestionRequest(@NotBlank @Size(max = AssistantFinancier.MESSAGE_LONGUEUR_MAX) String message) {
}
