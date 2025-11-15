# Habit Tracker - Java Backend

Java + Spring Boot implementation of the Habit Tracker API.

## Status

📅 **Planned** - Not yet implemented

## Tech Stack

- **Language**: Java 17+
- **Framework**: Spring Boot 3.x
- **Database**: PostgreSQL with JPA/Hibernate
- **Testing**: JUnit 5 + MockMvc
- **Validation**: Jakarta Validation
- **Authentication**: Spring Security + JWT
- **Build Tool**: Maven or Gradle

## Prerequisites

- JDK 17 or higher
- Maven 3.8+ or Gradle 8+
- PostgreSQL 14+ (or use Docker)

## Installation

```bash
# Using Maven
mvn clean install

# Run database migrations
mvn flyway:migrate

# Start development server
mvn spring-boot:run
```

## Development

```bash
# Run with hot reload
mvn spring-boot:run

# Run tests
mvn test

# Run tests with coverage
mvn test jacoco:report

# Package application
mvn package
```

## Environment Variables

Create an `application.yml` or `.env` file:

```yaml
spring:
  profiles:
    active: development
  datasource:
    url: jdbc:postgresql://localhost:5432/habittracker
    username: habituser
    password: habitpass
  jpa:
    hibernate:
      ddl-auto: validate
    show-sql: true

server:
  port: 3003

jwt:
  secret: your-secret-key-change-in-production
  expiration: 604800000
```

## Planned Structure

```
backends/java/
├── src/
│   ├── main/
│   │   ├── java/com/habittracker/
│   │   │   ├── config/
│   │   │   ├── controller/
│   │   │   ├── dto/
│   │   │   ├── entity/
│   │   │   ├── repository/
│   │   │   ├── service/
│   │   │   ├── security/
│   │   │   └── Application.java
│   │   └── resources/
│   │       ├── application.yml
│   │       └── db/migration/
│   └── test/
├── pom.xml
└── README.md
```

## License

MIT
