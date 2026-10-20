package com.example.gateway.web;

import java.net.ConnectException;
import java.net.UnknownHostException;
import java.util.LinkedHashMap;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.cloud.gateway.route.Route;
import org.springframework.cloud.gateway.support.ServerWebExchangeUtils;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.server.ServerWebExchange;
import org.springframework.web.server.WebExceptionHandler;

import io.netty.channel.ConnectTimeoutException;
import reactor.core.publisher.Mono;

/**
 * Service absent ou injoignable : 503 {"service": "<NOM>", "message": "Service indisponible"}.
 *
 * Deux cas : aucune instance dans Eureka pour une route lb:// (NotFoundException 503 de
 * la gateway), ou connexion refusée / hôte inconnu pour une URL directe.
 * Le nom affiché vient de metadata.service de la route (application.yml).
 * Les autres erreurs sont laissées au gestionnaire par défaut de Spring Boot.
 */
@Component
@Order(-2) // avant le gestionnaire d'erreurs par défaut de Spring Boot (-1)
public class ServiceUnavailableHandler implements WebExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(ServiceUnavailableHandler.class);

    @Override
    public Mono<Void> handle(ServerWebExchange exchange, Throwable ex) {
        if (exchange.getResponse().isCommitted() || !isUnavailable(ex)) {
            return Mono.error(ex);
        }
        String service = serviceName(exchange);
        log.warn("Service {} indisponible pour {} {} : {}", service, exchange.getRequest().getMethod(),
                exchange.getRequest().getPath().value(), ex.getMessage());
        Map<String, String> body = new LinkedHashMap<>();
        body.put("service", service);
        body.put("message", "Service indisponible");
        return JsonResponses.write(exchange.getResponse(), HttpStatus.SERVICE_UNAVAILABLE, body);
    }

    static boolean isUnavailable(Throwable ex) {
        if (ex instanceof ResponseStatusException rse
                && rse.getStatusCode().value() == HttpStatus.SERVICE_UNAVAILABLE.value()) {
            return true;
        }
        for (Throwable t = ex; t != null; t = t.getCause()) {
            if (t instanceof ConnectException || t instanceof UnknownHostException
                    || t instanceof ConnectTimeoutException) {
                return true;
            }
        }
        return false;
    }

    private static String serviceName(ServerWebExchange exchange) {
        Route route = exchange.getAttribute(ServerWebExchangeUtils.GATEWAY_ROUTE_ATTR);
        if (route == null) {
            return "inconnu";
        }
        Object name = route.getMetadata().get("service");
        return name != null ? name.toString() : route.getId();
    }
}
