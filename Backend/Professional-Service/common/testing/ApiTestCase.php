<?php

namespace Launchpad\Common\Testing;

use Launchpad\Common\Fixtures\FixtureUsers;
use Symfony\Bundle\FrameworkBundle\KernelBrowser;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;
use Symfony\Component\HttpFoundation\File\UploadedFile;

/**
 * Base des tests fonctionnels des microservices : base de test chargée avec les fixtures,
 * chaque test étant annulé en fin d'exécution (DAMA). Les autres services sont remplacés
 * par des doublures en mémoire (voir services.yaml, when@test).
 */
abstract class ApiTestCase extends WebTestCase
{
    protected const PREFIX = '/api/comptable';

    /** Personas des fixtures : sub => [rôles Keycloak, prénom, nom]. */
    private const USERS = [
        FixtureUsers::ACCOUNTANT_SONIA => [['ACCOUNTANT'], 'Sonia', 'Ben Ammar'],
        FixtureUsers::ACCOUNTANT_KARIM => [['ACCOUNTANT'], 'Karim', 'Trabelsi'],
        FixtureUsers::ACCOUNTANT_CLAIRE => [['ACCOUNTANT'], 'Claire', 'Dubois'],
        FixtureUsers::ACCOUNTANT_YOUSSEF => [['ACCOUNTANT'], 'Youssef', 'Mansouri'],
        FixtureUsers::ENTREPRENEUR_AMINE => [['ENTREPRENEUR'], 'Amine', 'Jaziri'],
        FixtureUsers::ENTREPRENEUR_LEILA => [['ENTREPRENEUR'], 'Leïla', 'Haddad'],
        FixtureUsers::ENTREPRENEUR_THOMAS => [['ENTREPRENEUR'], 'Thomas', 'Moreau'],
        FixtureUsers::ADMIN_NADIA => [['ADMIN'], 'Nadia', 'Khelifi'],
    ];

    protected KernelBrowser $client;
    private ?string $token = null;

    protected function setUp(): void
    {
        $this->client = static::createClient();
        // Une seule instance du noyau pendant le test : les doublures gardent leur état entre deux requêtes
        $this->client->disableReboot();
    }

    /** Les requêtes suivantes sont envoyées avec le jeton de cet utilisateur des fixtures. */
    protected function actingAs(string $sub): static
    {
        [$roles, $firstName, $lastName] = self::USERS[$sub];

        return $this->withToken(TestTokenFactory::create($sub, $roles, [
            'given_name' => $firstName,
            'family_name' => $lastName,
            'preferred_username' => strtolower($firstName),
            'email' => strtolower($firstName).'@launchpad.test',
        ]));
    }

    protected function withToken(?string $token): static
    {
        $this->token = $token;

        return $this;
    }

    /**
     * Requête JSON ; renvoie le corps décodé (null si vide).
     *
     * @param array<string, mixed>|null $json
     */
    protected function request(string $method, string $uri, ?array $json = null): ?array
    {
        return $this->requestRaw($method, $uri, null !== $json ? json_encode($json, \JSON_THROW_ON_ERROR) : null);
    }

    /** Requête avec un corps brut (ex. JSON volontairement invalide). */
    protected function requestRaw(string $method, string $uri, ?string $content, string $contentType = 'application/json'): ?array
    {
        $server = ['HTTP_ACCEPT' => 'application/json'];
        if (null !== $this->token) {
            $server['HTTP_AUTHORIZATION'] = 'Bearer '.$this->token;
        }
        if (null !== $content) {
            $server['CONTENT_TYPE'] = $contentType;
        }

        $this->client->request($method, self::PREFIX.$uri, server: $server, content: $content);

        return $this->responseData();
    }

    /**
     * Appel d'une route /internal (entre services), avec ou sans la clé partagée.
     *
     * @param array<string, mixed>|null $json
     */
    protected function internal(string $method, string $uri, ?array $json = null, ?string $key = 'launchpad-dev-internal-key'): ?array
    {
        $server = ['HTTP_ACCEPT' => 'application/json'];
        if (null !== $key) {
            $server['HTTP_X_INTERNAL_KEY'] = $key;
        }
        if (null !== $json) {
            $server['CONTENT_TYPE'] = 'application/json';
        }

        $this->client->request($method, '/internal'.$uri, server: $server, content: null !== $json ? json_encode($json, \JSON_THROW_ON_ERROR) : null);

        return $this->responseData();
    }

    /**
     * Requête multipart/form-data avec un fichier dans le champ "file".
     *
     * @param array<string, string> $fields
     */
    protected function upload(string $uri, array $fields, ?UploadedFile $file): ?array
    {
        $server = ['HTTP_ACCEPT' => 'application/json', 'CONTENT_TYPE' => 'multipart/form-data'];
        if (null !== $this->token) {
            $server['HTTP_AUTHORIZATION'] = 'Bearer '.$this->token;
        }

        $this->client->request('POST', self::PREFIX.$uri, $fields, null !== $file ? ['file' => $file] : [], $server);

        return $this->responseData();
    }

    protected function assertStatus(int $expected): void
    {
        $response = $this->client->getResponse();
        self::assertSame($expected, $response->getStatusCode(), 'Réponse inattendue : '.$response->getContent());
    }

    /** Vérifie le format d'erreur commun et renvoie le bloc "error". */
    protected function assertError(int $status, string $code): array
    {
        $this->assertStatus($status);
        $error = $this->responseData()['error'] ?? null;
        self::assertIsArray($error, 'Réponse d\'erreur sans bloc "error".');
        self::assertSame($status, $error['status']);
        self::assertSame($code, $error['code']);
        self::assertNotEmpty($error['message']);

        return $error;
    }

    /** Crée un fichier temporaire à déposer. */
    protected function makeUpload(string $filename, string $content, string $clientMimeType = 'application/pdf'): UploadedFile
    {
        $directory = static::getContainer()->getParameter('kernel.project_dir').'/var/test-tmp';
        if (!is_dir($directory)) {
            mkdir($directory, 0o777, true);
        }
        $path = tempnam($directory, 'upload_');
        file_put_contents($path, $content);

        return new UploadedFile($path, $filename, $clientMimeType, null, true);
    }

    protected function pdfContent(): string
    {
        return "%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n";
    }

    protected function responseData(): ?array
    {
        $content = $this->client->getResponse()->getContent();

        return '' === $content || false === $content ? null : json_decode($content, true, 512, \JSON_THROW_ON_ERROR);
    }
}
