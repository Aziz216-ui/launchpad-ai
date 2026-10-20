package com.launchpad.finance.infrastructure.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Paramètres du stockage objet compatible S3 (profils autres que dev).
 */
@ConfigurationProperties(prefix = "finance.stockage.objet")
public record StockageObjetProperties(String endpoint, String region, String bucket, String accessKey,
                                      String secretKey) {
}
