package com.launchpad.finance.domain;

import com.launchpad.finance.exception.DonneesInvalides;

import java.util.Arrays;
import java.util.Locale;
import java.util.UUID;

public enum FormatExport {
    PDF("pdf", "application/pdf"),
    EXCEL("xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

    private final String extension;
    private final String typeContenu;

    FormatExport(String extension, String typeContenu) {
        this.extension = extension;
        this.typeContenu = typeContenu;
    }

    public String extension() {
        return extension;
    }

    public String typeContenu() {
        return typeContenu;
    }

    /** Clé de stockage du fichier exporté d'un document (déterministe : un fichier par document et par format). */
    public String cleStockage(UUID documentId) {
        return documentId + "." + extension;
    }

    /** Résout le format à partir de son extension ("pdf" ou "xlsx"). */
    public static FormatExport depuisExtension(String extension) {
        if (extension == null) {
            throw new DonneesInvalides("Le format d'export est obligatoire (pdf ou xlsx)");
        }
        String normalise = extension.strip().toLowerCase(Locale.ROOT);
        return Arrays.stream(values())
                .filter(format -> format.extension.equals(normalise))
                .findFirst()
                .orElseThrow(() -> new DonneesInvalides("Format d'export inconnu : " + extension + " (pdf ou xlsx)"));
    }
}
