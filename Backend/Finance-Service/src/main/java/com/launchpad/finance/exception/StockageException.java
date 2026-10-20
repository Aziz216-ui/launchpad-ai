package com.launchpad.finance.exception;

/**
 * Erreur technique du stockage des fichiers (disque ou stockage objet).
 */
public class StockageException extends RuntimeException {

    public StockageException(String message, Throwable cause) {
        super(message, cause);
    }

    public StockageException(String message) {
        super(message);
    }
}
