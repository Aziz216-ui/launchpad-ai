package com.example.configserver;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.config.server.EnableConfigServer;

/**
 * Serveur de configuration centralisée de LaunchPad AI (Spring Cloud Config, port 8888).
 *
 * Sert les fichiers du dossier config-repo/ (profil "native") :
 *   application.yml   -> commun à tous les clients
 *   API-GATEWAY.yml   -> propre à l'application spring.application.name=API-GATEWAY
 * Un client les lit au démarrage via spring.config.import=optional:configserver:...
 * Exemple : GET http://localhost:8888/API-GATEWAY/default
 */
@SpringBootApplication
@EnableConfigServer
public class ConfigServerApplication {

    public static void main(String[] args) {
        SpringApplication.run(ConfigServerApplication.class, args);
    }

}
