# Espace Avocat Microservice (Lawyer-Space)

Independent Spring Boot microservice for the **Espace Avocat** (Lawyer Space) of **LaunchPad AI**.

## Technology Stack

- **Java 21**
- **Spring Boot 3.4.3**
- **Maven**
- **PostgreSQL** (`launchpad` database)
- **Spring Data JPA & Hibernate**
- **SpringDoc OpenAPI 3 / Swagger UI**

---

## Architecture & Package Structure

Located in [`Backend/Lawyer-Space/src/main/java/com/launchpad/lawyer`](./src/main/java/com/launchpad/lawyer):

- **`entity/`**: JPA domain entities mapping to PostgreSQL tables:
  - `Client.java` (`lawyer_clients`)
  - `Appointment.java` (`lawyer_appointments`)
  - `Message.java` (`lawyer_messages`)
  - `InformationRequest.java` (`lawyer_info_requests`)
  - `DocumentReview.java` (`lawyer_document_reviews`)
  - `ReviewComment.java` (`lawyer_review_comments`)
  - `ReviewHistory.java` (`lawyer_review_history`)
  - Status Enums: `ClientStatus`, `AppointmentStatus`, `SenderType`, `RequestStatus`, `ReviewStatus`
- **`repository/`**: Spring Data JPA repositories with query methods and overlap conflict checks.
- **`dto/`**: Strongly typed Request and Response records for input validation and clean API contracts.
- **`service/`**: Transactional business logic layer:
  - `ClientService`
  - `AppointmentService` (with overlapping appointment detection)
  - `CommunicationService`
  - `DocumentReviewService` (with comment addition and state change audit history)
- **`controller/`**: REST API Controllers annotated with Swagger OpenAPI 3.1 metadata:
  - `ClientController`
  - `AppointmentController`
  - `CommunicationController`
  - `DocumentReviewController`
- **`config/`**: OpenAPI and JWT Bearer security scheme setup (`OpenApiConfig.java`).
- **`exception/`**: Global exception handler for 404 Not Found, 409 Conflict, and validation errors.

---

## Interactive Documentation

- **Swagger UI**: [http://localhost:8082/swagger-ui.html](http://localhost:8082/swagger-ui.html)
- **OpenAPI 3.1 Spec**: [http://localhost:8082/v3/api-docs](http://localhost:8082/v3/api-docs)

---

## API Summary

### 1. Client Management (`/api/lawyer/clients`)
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/lawyer/clients` | Create a client associated with the authenticated lawyer |
| `GET` | `/api/lawyer/clients` | View and search clients (with `query` and `status` filter) |
| `GET` | `/api/lawyer/clients/{id}` | Get client details |
| `PUT` | `/api/lawyer/clients/{id}` | Update client information |
| `PATCH` | `/api/lawyer/clients/{id}/archive` | Archive a client |

### 2. Appointment Management (`/api/lawyer/appointments`)
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/lawyer/appointments` | Schedule an appointment (**detects overlapping collisions**) |
| `GET` | `/api/lawyer/appointments` | View appointments by date range, client, or status |
| `GET` | `/api/lawyer/appointments/{id}` | Get appointment details |
| `PATCH` | `/api/lawyer/appointments/{id}/reschedule` | Reschedule appointment (**validates conflicts**) |
| `PATCH` | `/api/lawyer/appointments/{id}/cancel` | Cancel an appointment |
| `PATCH` | `/api/lawyer/appointments/{id}/complete` | Mark appointment as completed |

### 3. Client Communication (`/api/lawyer/communication`)
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/lawyer/communication/messages` | Send message to a client |
| `GET` | `/api/lawyer/communication/messages/{clientId}` | Retrieve messages for a client |
| `POST` | `/api/lawyer/communication/requests` | Request missing information or documents |
| `GET` | `/api/lawyer/communication/requests` | Track requests and their statuses |
| `PATCH` | `/api/lawyer/communication/requests/{id}/status` | Update status (PENDING, SUBMITTED, APPROVED, REJECTED) |

### 4. Document Review (`/api/lawyer/reviews`)
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/lawyer/reviews` | Create review record on a mock document |
| `GET` | `/api/lawyer/reviews` | View document reviews (filter by client and status) |
| `GET` | `/api/lawyer/reviews/{id}` | Get review details with comments and full history |
| `POST` | `/api/lawyer/reviews/{id}/comments` | Add comments and request corrections |
| `PATCH` | `/api/lawyer/reviews/{id}/decision` | Approve or reject a review (records audit history) |

---

## Running and Testing

```powershell
# Run the microservice
mvn spring-boot:run

# Run test suite
mvn test
```
