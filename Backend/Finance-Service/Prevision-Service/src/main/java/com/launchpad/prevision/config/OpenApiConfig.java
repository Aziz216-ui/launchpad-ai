package com.launchpad.prevision.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Description OpenAPI de l'interface fournie IPrevision (Swagger UI : /swagger-ui.html).
 */
@Configuration(proxyBeanMethods = false)
public class OpenApiConfig {

    @Bean
    OpenAPI financeOpenApi() {
        return new OpenAPI().info(new Info()
                .title("LaunchPad - prevision-service (IPrevision)")
                .version("0.1.0")
                .description("Prévisions, marges, écarts, projections pluriannuelles "
                        + "et fonctions IA (commentaire d'écart, assistant, analyse de document)."));
    }
}
