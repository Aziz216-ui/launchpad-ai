# Eureka Discovery Server

Service discovery server for the **LaunchPad AI** microservices architecture, built with **Spring Cloud Netflix Eureka Server**.

---

## Overview

- **Port**: `8761`
- **Dashboard URL**: [http://localhost:8761](http://localhost:8761)
- **Eureka Service URL**: [http://localhost:8761/eureka/](http://localhost:8761/eureka/)
- **Application Name**: `eureka-server`

---

## How to Run

### Using Maven Wrapper

```bash
# Windows (PowerShell)
cd Backend/Eureka
.\mvnw.cmd spring-boot:run

# Linux / macOS
cd Backend/Eureka
./mvnw spring-boot:run
```

Once started, open [http://localhost:8761](http://localhost:8761) in your browser to view registered microservice instances.

---

## Registering Microservices (Clients)

### 1. Spring Boot Microservices (e.g. `Lawyer-Space`)

Add the Eureka Client starter to `pom.xml`:

```xml
<dependency>
    <groupId>org.springframework.cloud</groupId>
    <artifactId>spring-cloud-starter-netflix-eureka-client</artifactId>
</dependency>
```

Add the configuration in `application.yml`:

```yaml
eureka:
  client:
    service-url:
      defaultZone: ${EUREKA_SERVER_URL:http://localhost:8761/eureka/}
    fetch-registry: true
    register-with-eureka: true
  instance:
    prefer-ip-address: true
    instance-id: ${spring.application.name}:${server.port}
```

Annotate the main class with `@EnableDiscoveryClient`:

```java
@SpringBootApplication
@EnableDiscoveryClient
public class LawyerSpaceApplication {
    public static void main(String[] args) {
        SpringApplication.run(LawyerSpaceApplication.class, args);
    }
}
```

### 2. Python / Django Services (e.g. `User-Service`)

Python services can optionally register via `py_eureka_client`:

```bash
pip install py_eureka_client
```

And initialize registration upon startup:

```python
import py_eureka_client.eureka_client as eureka_client

eureka_client.init(
    eureka_server="http://localhost:8761/eureka",
    app_name="user-service",
    instance_port=8000
)
```
