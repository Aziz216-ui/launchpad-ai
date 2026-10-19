<?php

namespace App\Tests\Security;

use Jose\Component\Core\JWK;
use Jose\Component\Core\JWKSet;
use Jose\Component\KeyManagement\JWKFactory;

/**
 * Clés RSA utilisées pour signer les jetons de test, à la place de celles de Keycloak.
 * Générées au premier lancement dans var/test-keys (non versionné).
 */
final class TestKeys
{
    public const KEY_ID = 'launchpad-test-key';

    private static ?JWK $privateKey = null;

    public static function ensureGenerated(): void
    {
        self::privateKey();
    }

    /** Clé privée de signature (RS256). */
    public static function privateKey(): JWK
    {
        if (null !== self::$privateKey) {
            return self::$privateKey;
        }

        $path = self::directory().'/signing-key.json';
        if (!is_file($path)) {
            file_put_contents($path, json_encode(self::generateRsaKey(), \JSON_THROW_ON_ERROR));
        }

        return self::$privateKey = JWK::createFromJson((string) file_get_contents($path));
    }

    /** JWKS publié par le faux Keycloak (clé publique uniquement). */
    public static function publicJwks(): array
    {
        return (new JWKSet([self::privateKey()->toPublic()]))->jsonSerialize();
    }

    /** Clé étrangère au JWKS publié : pour simuler une signature invalide. */
    public static function foreignKey(): JWK
    {
        static $key = null;

        return $key ??= self::generateRsaKey();
    }

    /**
     * Sous Windows, OpenSSL a besoin d'un openssl.cnf : on utilise OPENSSL_CONF
     * ou, à défaut, celui livré avec PHP (extras/ssl/openssl.cnf).
     */
    private static function generateRsaKey(): JWK
    {
        $bundledConfig = \dirname(\PHP_BINARY).'/extras/ssl/openssl.cnf';
        $config = getenv('OPENSSL_CONF') ?: (is_file($bundledConfig) ? $bundledConfig : null);
        $options = null !== $config ? ['config' => $config] : [];

        $key = openssl_pkey_new(['private_key_bits' => 2048, 'private_key_type' => \OPENSSL_KEYTYPE_RSA] + $options);
        if (false === $key || !openssl_pkey_export($key, $pem, null, $options)) {
            throw new \RuntimeException('Impossible de générer la clé RSA de test : définissez la variable OPENSSL_CONF.');
        }

        return JWKFactory::createFromKey($pem, null, ['alg' => 'RS256', 'use' => 'sig', 'kid' => self::KEY_ID]);
    }

    private static function directory(): string
    {
        $directory = \dirname(__DIR__, 2).'/var/test-keys';
        if (!is_dir($directory)) {
            mkdir($directory, 0o700, true);
        }

        return $directory;
    }
}
