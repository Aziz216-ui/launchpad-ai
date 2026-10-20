package com.example.gateway;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.net.ServerSocket;
import java.util.concurrent.TimeUnit;
import java.util.function.Function;

import okhttp3.mockwebserver.Dispatcher;
import okhttp3.mockwebserver.MockResponse;
import okhttp3.mockwebserver.MockWebServer;
import okhttp3.mockwebserver.RecordedRequest;

/** Faux microservice (MockWebServer) qui répond selon la requête reçue. */
final class MockService {

    private final MockWebServer server = new MockWebServer();

    MockService(Function<RecordedRequest, MockResponse> responder) {
        server.setDispatcher(new Dispatcher() {
            @Override
            public MockResponse dispatch(RecordedRequest request) {
                return responder.apply(request);
            }
        });
        try {
            server.start();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    /** Service qui répond 200 {"chemin": "<chemin reçu>"} à toute requête. */
    static MockService echo() {
        return new MockService(request -> json(200, "{\"chemin\":\"" + request.getPath() + "\"}"));
    }

    static MockResponse json(int status, String body) {
        return new MockResponse().setResponseCode(status)
                .addHeader("Content-Type", "application/json")
                .setBody(body);
    }

    /** URL de base, ex. http://127.0.0.1:54321 */
    String url() {
        String url = server.url("/").toString();
        return url.substring(0, url.length() - 1);
    }

    /** Dernière requête reçue par le service (null si aucune dans la seconde). */
    RecordedRequest lastRequest() {
        try {
            RecordedRequest last = null;
            for (RecordedRequest r = server.takeRequest(1, TimeUnit.SECONDS); r != null;
                    r = server.takeRequest(50, TimeUnit.MILLISECONDS)) {
                last = r;
            }
            return last;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException(e);
        }
    }

    /** Oublie les requêtes déjà reçues. */
    void clear() {
        try {
            while (server.takeRequest(10, TimeUnit.MILLISECONDS) != null) {
                // vidage
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    /** URL d'un port local où rien n'écoute (service éteint). */
    static String closedPortUrl() {
        try (ServerSocket socket = new ServerSocket(0)) {
            return "http://127.0.0.1:" + socket.getLocalPort();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
}
