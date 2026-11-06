package com.launchpad.document.exception;

import java.util.UUID;

public class DocumentIntrouvable extends ExceptionMetier {

    public DocumentIntrouvable(UUID documentId) {
        super("Document financier introuvable : " + documentId);
    }
}
