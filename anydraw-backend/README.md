# AnyDraw Backend ☕

This is the Spring Boot backend server for **AnyDraw**, a real-time collaborative whiteboarding application. It manages REST APIs for user authentication, room management, and drives WebSocket synchronization for shapes drawing, permissions, waitlist approval, and room-based blocking.

---

## Tech Stack & Libraries 🛠️

- **Java Version**: 17
- **Framework**: Spring Boot 3.x
- **Real-Time Communication**: Spring WebSocket (TextWebSocketHandler)
- **Security & Authorization**: Spring Security, JWT (JSON Web Tokens), BCrypt password hashing
- **Database Engine**: MySQL
- **ORM & Data Layer**: Spring Data JPA, Hibernate
- **Build Tool**: Maven

---

## Folder Structure & Modules 📁

```text
anydraw-backend/
├── src/main/java/com/anydraw/
│   ├── config/          # Spring Security, CORS, WebSockets configuration
│   ├── controller/      # REST API Controllers (Auth, Rooms, etc.)
│   ├── dto/             # Data Transfer Objects (Request/Response models)
│   ├── model/           # Database JPA Entities (User, Room, PendingRequest)
│   ├── repository/      # Spring Data JPA Repositories
│   ├── service/         # Business Logic services
│   └── websocket/       # WebSocketHandler and RoomState managers
├── Dockerfile           # Eclipse Temurin container config for hosting
└── pom.xml              # Maven dependency configuration
```

---

## Configuration & Environments ⚙️

The application configuration is managed inside **`src/main/resources/application.properties`**. It uses environment variable placeholders so it can run locally with default settings while supporting seamless production overrides.

### Core Environment Variables

| Variable Name | Description | Example (Production) |
| :--- | :--- | :--- |
| `SPRING_DATASOURCE_URL` | MySQL JDBC Connection URL | `jdbc:mysql://host:3306/db_name?ssl-mode=REQUIRED` |
| `SPRING_DATASOURCE_USERNAME`| Database Username | `xyz` |
| `SPRING_DATASOURCE_PASSWORD`| Database Password | `<secure_password>` |
| `JWT_SECRET` | Secret token to sign and verify JWT keys | `<long_random_secure_secret>` |
| `SPRING_PROFILES_ACTIVE` | Active Spring profile (defaults to `local`) | `prod` |
| `ALLOWED_ORIGINS` | Permitted origins for REST API CORS requests | `Your Frontend Live URL` |

---

## Local Development Setup 🚀

1. Ensure MySQL is running on your computer. Create a database called `anydraw`.
2. Create your local secrets properties file named `src/main/resources/application-local.properties` (this file is ignored by Git):
   ```properties
   spring.datasource.password=YOUR_LOCAL_MYSQL_PASSWORD
   jwt.secret=your_local_secure_jwt_secret_key
   ```
3. Compile and launch the Spring Boot server:
   ```bash
   ./mvnw spring-boot:run
   ```
   The backend will be live on `http://localhost:8080`.
