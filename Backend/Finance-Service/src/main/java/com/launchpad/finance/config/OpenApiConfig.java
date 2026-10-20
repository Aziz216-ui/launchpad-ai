package com.launchpad.finance.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Description OpenAPI de l'interface fournie IFinance (Swagger UI : /swagger-ui.html).
 */
@Configuration(proxyBeanMethods = false)
public class OpenApiConfig {

    @Bean
    OpenAPI financeOpenApi() {
        return new OpenAPI().info(new Info()
                .title("LaunchPad - finance-service (IFinance)")
                .version("0.1.0")
                .description("Gestion financière : prévisions, marges, écarts, projections pluriannuelles, "
                        + "documents financiers et export PDF / Excel."));
    }
}
