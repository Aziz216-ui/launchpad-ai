<?php

namespace App\Discovery;

use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Contracts\HttpClient\Exception\ExceptionInterface;
use Symfony\Contracts\HttpClient\HttpClientInterface;

/**
 * Client minimal de l'API REST Eureka (aucun client officiel n'existe en PHP) :
 * enregistrement, battement de cœur (renouvellement du bail) et désinscription.
 *
 * @see https://github.com/Netflix/eureka/wiki/Eureka-REST-operations
 */
final class EurekaClient
{
    /** Durée du bail : Eureka retire l'instance sans battement de cœur pendant ce délai. */
    public const LEASE_DURATION = 90;

    private readonly string $serverUrl;
    private readonly string $appName;

    public function __construct(
        private readonly HttpClientInterface $httpClient,
        #[Autowire(env: 'EUREKA_SERVER_URL')] string $serverUrl,
        #[Autowire(env: 'EUREKA_APP_NAME')] string $appName,
        #[Autowire(env: 'EUREKA_INSTANCE_HOST')] private readonly string $host,
        #[Autowire(env: 'EUREKA_INSTANCE_IP')] private readonly string $ipAddress,
        #[Autowire(env: 'int:APP_PORT')] private readonly int $port,
        #[Autowire(env: 'int:EUREKA_HEARTBEAT_INTERVAL')] private readonly int $heartbeatInterval,
    ) {
        $this->serverUrl = rtrim($serverUrl, '/');
        $this->appName = strtoupper($appName);
    }

    /** Identifiant d'instance au format Spring Cloud : hôte:application:port. */
    public function getInstanceId(): string
    {
        return sprintf('%s:%s:%d', $this->host, strtolower($this->appName), $this->port);
    }

    public function getAppName(): string
    {
        return $this->appName;
    }

    public function getHeartbeatInterval(): int
    {
        return $this->heartbeatInterval;
    }

    /**
     * POST /apps/{APP} : déclare l'instance avec le statut UP.
     *
     * @throws EurekaException
     */
    public function register(): void
    {
        $this->send('POST', $this->appUrl(), ['json' => ['instance' => $this->instancePayload()]], [200, 204]);
    }

    /**
     * PUT /apps/{APP}/{instanceId} : renouvelle le bail.
     * Si Eureka ne connaît plus l'instance (redémarrage du serveur, bail expiré), elle est réenregistrée.
     *
     * @return bool true si un réenregistrement a été nécessaire
     *
     * @throws EurekaException
     */
    public function heartbeat(): bool
    {
        if (404 === $this->send('PUT', $this->instanceUrl(), [], [200, 404])) {
            $this->register();

            return true;
        }

        return false;
    }

    /**
     * DELETE /apps/{APP}/{instanceId} : retire l'instance à l'arrêt du service.
     *
     * @throws EurekaException
     */
    public function deregister(): void
    {
        $this->send('DELETE', $this->instanceUrl(), [], [200, 404]);
    }

    /**
     * @return array<string, mixed>
     */
    public function instancePayload(): array
    {
        $baseUrl = sprintf('http://%s:%d', $this->host, $this->port);
        $vipAddress = strtolower($this->appName);

        return [
            'instanceId' => $this->getInstanceId(),
            'hostName' => $this->host,
            'app' => $this->appName,
            'ipAddr' => $this->ipAddress,
            'vipAddress' => $vipAddress,
            'secureVipAddress' => $vipAddress,
            'status' => 'UP',
            'port' => ['$' => $this->port, '@enabled' => 'true'],
            'securePort' => ['$' => 443, '@enabled' => 'false'],
            'homePageUrl' => $baseUrl.'/',
            'statusPageUrl' => $baseUrl.'/api/comptable/health',
            'healthCheckUrl' => $baseUrl.'/api/comptable/health',
            'dataCenterInfo' => [
                '@class' => 'com.netflix.appinfo.InstanceInfo$DefaultDataCenterInfo',
                'name' => 'MyOwn',
            ],
            'leaseInfo' => [
                'renewalIntervalInSecs' => $this->heartbeatInterval,
                'durationInSecs' => self::LEASE_DURATION,
            ],
            'metadata' => [
                'technology' => 'php-symfony',
                'apiPrefix' => '/api/comptable',
            ],
        ];
    }

    /**
     * @param array<string, mixed> $options
     * @param list<int>            $expectedStatuses
     *
     * @throws EurekaException
     */
    private function send(string $method, string $url, array $options, array $expectedStatuses): int
    {
        try {
            $status = $this->httpClient->request($method, $url, $options + [
                'headers' => ['Accept' => 'application/json'],
                'timeout' => 5,
            ])->getStatusCode();
        } catch (ExceptionInterface $e) {
            throw new EurekaException(sprintf('Eureka injoignable (%s %s) : %s', $method, $url, $e->getMessage()), 0, $e);
        }

        if (!\in_array($status, $expectedStatuses, true)) {
            throw new EurekaException(sprintf('Réponse inattendue d\'Eureka (%s %s) : HTTP %d', $method, $url, $status));
        }

        return $status;
    }

    private function appUrl(): string
    {
        return $this->serverUrl.'/apps/'.rawurlencode($this->appName);
    }

    private function instanceUrl(): string
    {
        return $this->appUrl().'/'.rawurlencode($this->getInstanceId());
    }
}
