<?php

namespace App\Tests\Unit;

use App\Discovery\EurekaClient;
use App\Discovery\EurekaException;
use PHPUnit\Framework\TestCase;
use Symfony\Component\HttpClient\MockHttpClient;
use Symfony\Component\HttpClient\Response\MockResponse;

final class EurekaClientTest extends TestCase
{
    private const APP_URL = 'http://eureka.test:8761/eureka/apps/PROFESSIONAL-SERVICE';
    private const INSTANCE_URL = self::APP_URL.'/localhost%3Aprofessional-service%3A8085';

    /** @var list<array{method: string, url: string, body: string}> */
    private array $requests = [];

    public function testRegisterSendsSpringCompatibleInstance(): void
    {
        $this->client([new MockResponse('', ['http_code' => 204])])->register();

        self::assertSame('POST', $this->requests[0]['method']);
        self::assertSame(self::APP_URL, $this->requests[0]['url']);

        $instance = json_decode($this->requests[0]['body'], true)['instance'];
        self::assertSame('localhost:professional-service:8085', $instance['instanceId']);
        self::assertSame('PROFESSIONAL-SERVICE', $instance['app']);
        self::assertSame('professional-service', $instance['vipAddress']);
        self::assertSame('UP', $instance['status']);
        self::assertSame(['$' => 8085, '@enabled' => 'true'], $instance['port']);
        self::assertSame('http://localhost:8085/api/comptable/health', $instance['healthCheckUrl']);
        self::assertSame('MyOwn', $instance['dataCenterInfo']['name']);
        self::assertSame(30, $instance['leaseInfo']['renewalIntervalInSecs']);
    }

    public function testHeartbeatRenewsLease(): void
    {
        $reregistered = $this->client([new MockResponse('', ['http_code' => 200])])->heartbeat();

        self::assertFalse($reregistered);
        self::assertSame('PUT', $this->requests[0]['method']);
        self::assertSame(self::INSTANCE_URL, $this->requests[0]['url']);
    }

    public function testHeartbeatReregistersWhenEurekaForgotTheInstance(): void
    {
        $reregistered = $this->client([
            new MockResponse('', ['http_code' => 404]),
            new MockResponse('', ['http_code' => 204]),
        ])->heartbeat();

        self::assertTrue($reregistered);
        self::assertSame(['PUT', 'POST'], array_column($this->requests, 'method'));
    }

    public function testDeregisterDeletesInstance(): void
    {
        $this->client([new MockResponse('', ['http_code' => 200])])->deregister();

        self::assertSame('DELETE', $this->requests[0]['method']);
        self::assertSame(self::INSTANCE_URL, $this->requests[0]['url']);
    }

    public function testUnexpectedStatusRaisesException(): void
    {
        $this->expectException(EurekaException::class);

        $this->client([new MockResponse('', ['http_code' => 500])])->register();
    }

    public function testUnreachableServerRaisesException(): void
    {
        $this->expectException(EurekaException::class);

        $this->client([new MockResponse('', ['error' => 'Connection refused'])])->register();
    }

    /**
     * @param list<MockResponse> $responses
     */
    private function client(array $responses): EurekaClient
    {
        $httpClient = new MockHttpClient(function (string $method, string $url, array $options) use (&$responses): MockResponse {
            $this->requests[] = ['method' => $method, 'url' => $url, 'body' => (string) ($options['body'] ?? '')];

            return array_shift($responses);
        });

        return new EurekaClient($httpClient, 'http://eureka.test:8761/eureka/', 'professional-service', 'localhost', '127.0.0.1', 8085, 30);
    }
}
