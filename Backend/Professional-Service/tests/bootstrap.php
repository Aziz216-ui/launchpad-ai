<?php

use App\Tests\Security\TestKeys;
use Symfony\Component\Dotenv\Dotenv;

require dirname(__DIR__).'/vendor/autoload.php';

if (method_exists(Dotenv::class, 'bootEnv')) {
    (new Dotenv())->bootEnv(dirname(__DIR__).'/.env');
}

if ($_SERVER['APP_DEBUG']) {
    umask(0000);
}

// Paire de clés RSA de test, générée localement dans var/ (jamais versionnée)
TestKeys::ensureGenerated();
