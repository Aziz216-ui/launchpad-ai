package com.launchpad.finance.presentation;

import com.launchpad.finance.domain.exception.DocumentIntrouvable;
import com.launchpad.finance.domain.exception.DonneesInvalides;
import com.launchpad.finance.domain.exception.ExceptionMetier;
import com.launchpad.finance.domain.exception.PrevisionIntrouvable;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.lang.Nullable;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;

import java.util.Map;
import java.util.stream.Collectors;

/**
 * Seul point de traduction des exceptions métier en codes HTTP, au format ProblemDetail (RFC 7807).
 * Les erreurs techniques de Spring MVC (JSON illisible, paramètre mal typé…) sont gérées par la classe mère.
 */
@RestControllerAdvice
public class GestionErreursAdvice extends ResponseEntityExceptionHandler {

    @ExceptionHandler({PrevisionIntrouvable.class, DocumentIntrouvable.class})
    public ProblemDetail ressourceIntrouvable(ExceptionMetier exception) {
        return probleme(HttpStatus.NOT_FOUND, "Ressource introuvable", exception.getMessage());
    }

    @ExceptionHandler(DonneesInvalides.class)
    public ProblemDetail donneesInvalides(DonneesInvalides exception) {
        return probleme(HttpStatus.BAD_REQUEST, "Données invalides", exception.getMessage());
    }

    /** Toute autre erreur : 500 sans divulguer le détail technique, qui est journalisé. */
    @ExceptionHandler(Exception.class)
    public ProblemDetail erreurInterne(Exception exception) {
        logger.error("Erreur interne non gérée", exception);
        return probleme(HttpStatus.INTERNAL_SERVER_ERROR, "Erreur interne",
                "Une erreur inattendue est survenue. Réessayez plus tard.");
    }

    /** Erreurs de Bean Validation : détail par champ dans la propriété "erreurs". */
    @Override
    protected ResponseEntity<Object> handleMethodArgumentNotValid(MethodArgumentNotValidException exception,
                                                                  HttpHeaders headers, HttpStatusCode status,
                                                                  WebRequest request) {
        ProblemDetail probleme = probleme(HttpStatus.BAD_REQUEST, "Données invalides",
                "La requête contient des champs invalides");
        Map<String, String> erreurs = exception.getBindingResult().getFieldErrors().stream()
                .collect(Collectors.toMap(e -> e.getField(), e -> messageOuDefaut(e.getDefaultMessage()),
                        (premier, second) -> premier + " ; " + second));
        probleme.setProperty("erreurs", erreurs);
        return handleExceptionInternal(exception, probleme, headers, status, request);
    }

    private static ProblemDetail probleme(HttpStatus statut, String titre, String detail) {
        ProblemDetail probleme = ProblemDetail.forStatusAndDetail(statut, detail);
        probleme.setTitle(titre);
        return probleme;
    }

    private static String messageOuDefaut(@Nullable String message) {
        return message == null ? "valeur invalide" : message;
    }
}
