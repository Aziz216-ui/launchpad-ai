package com.launchpad.document.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Description OpenAPI de l'interface fournie IDocument (Swagger UI : /swagger-ui.html).
 */
@Configuration(proxyBeanMethods = false)
public class OpenApiConfig {

    @Bean
    OpenAPI financeOpenApi() {
        return new OpenAPI().info(new Info()
                .title("LaunchPad - document-service (IDocument)")
                .version("0.1.0")
                .description("Documents financiers (business plan, bilan, compte de résultat, plan de trésorerie, "
                        + "rapport investisseur), export PDF / Excel et notifications."));
    }
}
