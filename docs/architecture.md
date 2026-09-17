# Architecture Documentation

## System Overview

The SuretySeven Bond Application Processing System is a reliable, scalable platform for automating surety bond underwriting. It accepts applications via REST API, evaluates them asynchronously using deterministic rules, and notifies downstream systems of decisions.

## Architecture Style

**Modular Monolith with Asynchronous Processing**

The system is deployed as a single application with clear internal module boundaries but runs background workers as separate processes. This provides:

- Simplified deployment and testing
- ACID transactions across related data
- Clear separation of concerns through modules
- Independent scaling of API and workers

## Component Architecture

### High-Level Components

```
┌─────────────────────────────────────────────────────────────┐
│                    External Systems                         │
│  ┌──────────────────┐           ┌──────────────────┐       │
│  │  Applicant API   │           │ Downstream System│       │
│  └────────▲─────────┘           └────────▲─────────┘       │
└───────────┼──────────────────────────────┼──────────────────┘
            │                              │
            │                              │
┌───────────┼──────────────────────────────┼──────────────────┐
│           │          SuretySeven         │                  │
│           │                              │                  │
│  ┌────────┴─────────┐         ┌──────────┴─────────┐       │
│  │ Applicant Client │         │ Notification Client│       │
│  └────────▲─────────┘         └──────────▲─────────┘       │
│           │                              │                  │
│  ┌────────┴────────────────────┬─────────┴─────────┐       │
│  │   Evaluation Worker         │ Notification Worker│       │
│  │  (BullMQ Consumer)          │  (BullMQ Consumer) │       │
│  └────────▲────────────────────┴─────────▲─────────┘       │
│           │                              │                  │
│           │       Redis/BullMQ           │                  │
│  ┌────────┴──────────────────────────────┴─────────┐       │
│  │              Queue Service                       │       │
│  └────────▲─────────────────────────────────────────┘       │
│           │                                                 │
│  ┌────────┴─────────────────────────────────────────┐      │
│  │          Application Service                     │      │
│  │  ┌──────────────┐    ┌─────────────────────┐    │      │
│  │  │ Idempotency  │    │ Underwriting Engine │    │      │
│  │  │   Service    │    │   (Scoring Rules)   │    │      │
│  │  └──────────────┘    └─────────────────────┘    │      │
│  └────────▲─────────────────────────────────────────┘      │
│           │                                                 │
│  ┌────────┴─────────────────────────────────────────┐      │
│  │              REST API (Express)                  │      │
│  │    POST /applications    GET /applications/:id   │      │
│  └────────▲─────────────────────────────────────────┘      │
└───────────┼──────────────────────────────────────────────────┘
            │
┌───────────┴──────────────────────────────────────────────────┐
│                     Data Layer                               │
│  ┌─────────────────────┐      ┌─────────────────────┐       │
│  │    PostgreSQL       │      │       Redis         │       │
│  │                     │      │                     │       │
│  │ - Applications      │      │ - Job Queues        │       │
│  │ - Applicant Snapshot│      │ - Job State         │       │
│  │ - Decision Factors  │      │                     │       │
│  │ - Outbox Events     │      │                     │       │
│  │ - Idempotency       │      │                     │       │
│  └─────────────────────┘      └─────────────────────┘       │
└──────────────────────────────────────────────────────────────┘
```

## Module Structure

```
src/
├── app.ts                      # Express app configuration
├── server.ts                   # HTTP server entry point
├── config/
│   └── env.ts                  # Environment validation
├── common/
│   ├── errors/                 # Domain errors
│   ├── logging/                # Structured logging
│   ├── middleware/             # Request middleware
│   └── utils/                  # Shared utilities
├── infrastructure/
│   ├── prisma/                 # Database client
│   ├── redis/                  # Redis client
│   └── queues/                 # Queue service
├── modules/
│   ├── applications/           # Core application domain
│   │   ├── application.controller.ts
│   │   ├── application.service.ts
│   │   ├── application.repository.ts
│   │   ├── application.routes.ts
│   │   ├── application.schemas.ts
│   │   └── application.types.ts
│   ├── underwriting/           # Scoring engine
│   │   ├── underwriting.engine.ts
│   │   ├── underwriting.rules.ts
│   │   └── underwriting.types.ts
│   ├── applicant/              # External applicant API
│   │   ├── applicant.client.ts
│   │   └── applicant.types.ts
│   ├── idempotency/            # Idempotency handling
│   │   └── idempotency.service.ts
│   ├── outbox/                 # Outbox pattern
│   │   ├── outbox.service.ts
│   │   └── outbox.types.ts
│   ├── notifications/          # Downstream notifications
│   │   └── notification.client.ts
│   ├── external/               # Mock external APIs
│   │   ├── mock-applicant.routes.ts
│   │   └── mock-downstream.routes.ts
│   └── health/                 # Health checks
│       └── health.routes.ts
└── workers/
    ├── index.ts                # Worker entry point
    ├── evaluation.worker.ts    # Underwriting worker
    └── notification.worker.ts  # Notification worker
```

## Data Model

### Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────┐
│                   Application                       │
├─────────────────────────────────────────────────────┤
│ PK: id                                              │
│ UK: applicationId                                   │
│     applicantId                                     │
│     bondType                                        │
│     bondAmount                                      │
│     effectiveDate                                   │
│     obligeeName                                     │
│     status (PENDING/EVALUATING/APPROVED/...)       │
│     score                                           │
│     decision                                        │
│     failureCode                                     │
│     failureMessage                                  │
│     createdAt, updatedAt                            │
└──────────────┬──────────────────────────────────────┘
               │
               │ 1:1
               │
               ▼
┌─────────────────────────────────────────────────────┐
│              ApplicantSnapshot                      │
├─────────────────────────────────────────────────────┤
│ PK: id                                              │
│ FK: applicationId → Application.applicationId       │
│     applicantId                                     │
│     annualRevenue                                   │
│     yearsInBusiness                                 │
│     creditScore                                     │
│     existingExposure                                │
│     retrievedAt                                     │
└─────────────────────────────────────────────────────┘

               │ 1:N
               │
               ▼
┌─────────────────────────────────────────────────────┐
│              DecisionFactor                         │
├─────────────────────────────────────────────────────┤
│ PK: id                                              │
│ FK: applicationId → Application.applicationId       │
│     factor (CREDIT_SCORE, YEARS_IN_BUSINESS, ...)  │
│     inputValue                                      │
│     rule                                            │
│     points                                          │
│     explanation                                     │
│     createdAt                                       │
└─────────────────────────────────────────────────────┘

               │ 1:N
               │
               ▼
┌─────────────────────────────────────────────────────┐
│                OutboxEvent                          │
├─────────────────────────────────────────────────────┤
│ PK: id                                              │
│ UK: eventId                                         │
│ FK: applicationId → Application.applicationId       │
│     eventType                                       │
│     payload (JSON)                                  │
│     status (PENDING/PROCESSING/DELIVERED/FAILED)   │
│     attempts                                        │
│     availableAt                                     │
│     lastError                                       │
│     createdAt, deliveredAt                          │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│            IdempotencyRecord                        │
├─────────────────────────────────────────────────────┤
│ PK: id                                              │
│ UK: key (idempotency key from header)              │
│     requestHash                                     │
│     applicationId                                   │
│     responseData (JSON)                             │
│     createdAt, expiresAt                            │
└─────────────────────────────────────────────────────┘
```

### Indexes

Critical indexes for performance:

- `applications.applicationId` (unique)
- `applications.applicantId` (query by applicant)
- `applications.status` (filter pending/evaluating)
- `applications.createdAt` (time-based queries)
- `outbox_events.eventId` (unique)
- `outbox_events.(status, availableAt)` (outbox polling)
- `idempotency_records.key` (unique)
- `idempotency_records.expiresAt` (cleanup)

## Request Flow

### 1. Create Application (Happy Path)

```
Client                API              DB           Queue        Worker
  │                    │               │             │             │
  │ POST /applications │               │             │             │
  ├───────────────────>│               │             │             │
  │                    │               │             │             │
  │                    │ Check         │             │             │
  │                    │ Idempotency   │             │             │
  │                    ├──────────────>│             │             │
  │                    │<──────────────┤             │             │
  │                    │  Not found    │             │             │
  │                    │               │             │             │
  │                    │ INSERT        │             │             │
  │                    │ Application   │             │             │
  │                    │ (PENDING)     │             │             │
  │                    ├──────────────>│             │             │
  │                    │<──────────────┤             │             │
  │                    │   Success     │             │             │
  │                    │               │             │             │
  │                    │ Enqueue       │             │             │
  │                    │ Evaluation    │             │             │
  │                    ├──────────────────────────────>           │
  │                    │               │             │             │
  │  201 Created       │               │             │             │
  │  {applicationId}   │               │             │             │
  │<───────────────────┤               │             │             │
  │                    │               │             │             │
  │                    │               │             │   Dequeue   │
  │                    │               │             │   Job       │
  │                    │               │             ├────────────>│
  │                    │               │             │             │
  │                    │               │             │   Process   │
  │                    │               │             │<────────────┤
  │                    │               │             │             │
  │                    │               │    UPDATE   │             │
  │                    │               │<EVALUATING──┤             │
  │                    │               │             │             │
  │                    │               │    Fetch    │             │
  │                    │               │  Applicant  │             │
  │                    │               │   (retry)   │             │
  │                    │               │             │             │
  │                    │               │    INSERT   │             │
  │                    │               │  Snapshot   │             │
  │                    │               │<────────────┤             │
  │                    │               │             │             │
  │                    │               │    Score    │             │
  │                    │               │ Application │             │
  │                    │               │             │             │
  │                    │               │  BEGIN TX   │             │
  │                    │               │<────────────┤             │
  │                    │               │    UPDATE   │             │
  │                    │               │  (APPROVED) │             │
  │                    │               │<────────────┤             │
  │                    │               │    INSERT   │             │
  │                    │               │    Factors  │             │
  │                    │               │<────────────┤             │
  │                    │               │    INSERT   │             │
  │                    │               │   Outbox    │             │
  │                    │               │<────────────┤             │
  │                    │               │  COMMIT TX  │             │
  │                    │               │<────────────┤             │
  │                    │               │             │             │
```

### 2. Duplicate Request Handling

```
Client                API              DB        
  │                    │               │         
  │ POST /applications │               │         
  │ Idempotency-Key: X │               │         
  ├───────────────────>│               │         
  │                    │               │         
  │                    │ SELECT        │         
  │                    │ WHERE key=X   │         
  │                    ├──────────────>│         
  │                    │<──────────────┤         
  │                    │  Found record │         
  │                    │               │         
  │                    │ Compare hash  │         
  │                    │ (matches)     │         
  │                    │               │         
  │  201 Created       │               │         
  │  {cached response} │               │         
  │<───────────────────┤               │         
  │                    │               │         
```

### 3. Outbox Pattern Flow

```
Worker           DB                    Downstream
  │               │                         │
  │ Poll Outbox   │                         │
  ├──────────────>│                         │
  │<──────────────┤                         │
  │  Events       │                         │
  │               │                         │
  │ UPDATE        │                         │
  │ (PROCESSING)  │                         │
  ├──────────────>│                         │
  │               │                         │
  │ Send Event                              │
  ├────────────────────────────────────────>│
  │<────────────────────────────────────────┤
  │               200 OK                    │
  │               │                         │
  │ UPDATE        │                         │
  │ (DELIVERED)   │                         │
  ├──────────────>│                         │
  │               │                         │
```

## State Machine

Application states and valid transitions:

```
                    ┌──────────┐
                    │ PENDING  │
                    └────┬─────┘
                         │
                ┌────────┼────────┐
                │                 │
                ▼                 ▼
          ┌───────────┐      ┌────────┐
          │EVALUATING │      │ FAILED │
          └─────┬─────┘      └────────┘
                │              (terminal)
       ┌────────┼────────┐
       │        │        │
       ▼        ▼        ▼
  ┌─────────┐ ┌────────┐ ┌─────────┐
  │APPROVED │ │REFERRED│ │DECLINED │
  └─────────┘ └────────┘ └─────────┘
  (terminal)  (terminal)  (terminal)
```

**Terminal States**: Once in APPROVED, REFERRED, DECLINED, or FAILED, applications cannot transition to other states.

**Reason**: Final decisions should be immutable to maintain audit trail and prevent inconsistent downstream notifications.

## Reliability Patterns

### 1. Idempotency

**Problem**: Network failures cause clients to retry requests, potentially creating duplicate applications.

**Solution**:
1. Client includes `Idempotency-Key` header (UUID or application-specific key)
2. System computes hash of request body
3. On first request: store key + hash + applicationId in database (unique constraint)
4. On retry: lookup by key, verify hash matches, return cached response
5. If key exists with different hash: return 409 Conflict

**Database Constraint**:
```sql
CREATE UNIQUE INDEX idempotency_records_key_key 
ON idempotency_records(key);
```

This prevents race conditions where two concurrent identical requests both pass the SELECT but try to INSERT.

### 2. Outbox Pattern

**Problem**: Dual-write problem—if we persist decision and then send notification, a crash between operations causes lost notification.

**Solution**:
1. Within same database transaction:
   - Update application status
   - Insert decision factors
   - Insert outbox event
2. Commit transaction
3. Separate worker polls outbox for PENDING events
4. Worker sends notification
5. On success, mark event DELIVERED
6. On failure, increment attempts and schedule retry

**Why This Works**: Database transaction ensures decision + outbox event are atomic. Even if worker crashes, event remains in database for retry.

### 3. Retry with Exponential Backoff

**Applicant API**:
```
Attempt 1: immediate
Attempt 2: ~2s delay
Attempt 3: ~4s delay
Attempt 4: ~8s delay (max 10s)
```

**Downstream API**:
```
Attempt 1: immediate
Attempt 2: ~5s delay
Attempt 3: ~10s delay
Attempt 4: ~20s delay
Attempt 5: ~40s delay (max 60s)
```

Jitter added to prevent thundering herd.

### 4. Circuit Breaking

Currently not implemented but would add:
- Track error rate per external service
- If error rate > threshold, open circuit (fail fast)
- After cooldown period, allow test requests (half-open)
- If successful, close circuit (resume normal operation)

### 5. Graceful Degradation

**Applicant API Timeout**:
- Mark application as FAILED with clear error code
- Application remains in database
- Client can see failure reason
- Manual intervention possible

**Downstream API Failure**:
- Decision remains APPROVED/DECLINED (not rolled back)
- Notification scheduled for retry
- Application state is correct even if notification never succeeds

## Security Considerations

### 1. Input Validation

- Zod schemas validate all request bodies
- Reject unknown fields
- Enforce type constraints (positive numbers, valid dates, enum values)
- Limit string lengths to prevent storage attacks

### 2. Rate Limiting

- In-memory rate limiter (100 requests/minute per IP)
- Returns 429 Too Many Requests
- Can be upgraded to Redis-backed for distributed rate limiting

### 3. Error Handling

- Never expose stack traces in production
- Generic error messages to clients
- Detailed errors logged with correlation IDs
- No sensitive data in logs (credentials, tokens)

### 4. Database Security

- Parameterized queries (Prisma ORM prevents SQL injection)
- Foreign key constraints maintain referential integrity
- Cascade deletes prevent orphaned records

### 5. Secrets Management

- All secrets in environment variables
- No credentials in code or version control
- `.env` file in `.gitignore`

### Future Security Enhancements

- Authentication (JWT tokens)
- Authorization (role-based access)
- TLS for all external communication
- Encrypted sensitive fields in database
- Audit log of all actions
- WAF for DDoS protection

## Monitoring and Observability

### Structured Logging

All logs are JSON with:
- `level`: error, warn, info, debug
- `timestamp`: ISO 8601
- `requestId`: correlation ID
- `applicationId`: business entity
- `operation`: what was being done
- `duration`: for slow operations
- `error`: structured error information

### Health Checks

**GET /health**: Basic liveness probe
- Returns 200 if process is running
- Used by load balancer to detect crashed instances

**GET /ready**: Readiness probe
- Checks PostgreSQL connectivity
- Checks Redis connectivity
- Returns 503 if dependencies unavailable
- Used by Kubernetes for rolling deployments

### Metrics (Not Yet Implemented)

Future metrics to expose:

**Application Metrics**:
- `applications_created_total` (counter)
- `applications_by_status` (gauge)
- `applications_processing_duration` (histogram)

**Underwriting Metrics**:
- `underwriting_evaluations_total` (counter)
- `underwriting_score_distribution` (histogram)
- `underwriting_decision_counts` (counter by decision type)

**External API Metrics**:
- `applicant_api_requests_total` (counter)
- `applicant_api_errors_total` (counter by type)
- `applicant_api_duration` (histogram)
- `downstream_api_requests_total` (counter)
- `downstream_api_errors_total` (counter)

**Queue Metrics**:
- `queue_jobs_waiting` (gauge)
- `queue_jobs_active` (gauge)
- `queue_jobs_completed_total` (counter)
- `queue_jobs_failed_total` (counter)

### Alerting Strategy

**Critical Alerts** (page on-call):
- Application error rate > 5%
- Database connection pool exhausted
- Redis unavailable
- Queue depth > 1000 for > 10 minutes

**Warning Alerts** (slack notification):
- External API error rate > 10%
- P95 latency > 2 seconds
- Outbox event lag > 5 minutes
- Failed jobs increasing

## Trade-offs and Alternatives

### 1. Synchronous vs Asynchronous Processing

**Chosen**: Asynchronous

**Alternative**: Synchronous—POST /applications waits for underwriting and returns final decision

**Reasoning**:
- Synchronous couples our uptime to external API uptime
- Slow external APIs would timeout client requests
- Cannot implement proper retry for transient failures
- Hard to implement fair queuing under load

**When Synchronous Makes Sense**: If SLA requires instant decision AND external API is reliable with < 100ms latency

### 2. Outbox vs Event Streaming

**Chosen**: Polling outbox with PostgreSQL

**Alternative**: Change Data Capture (CDC) or Kafka

**Reasoning**:
- Outbox is simpler with fewer moving parts
- No additional infrastructure (Kafka cluster, CDC connector)
- Polling frequency acceptable for use case (5 seconds)
- Can evolve to CDC later without changing application code

**When Kafka Makes Sense**: > 10,000 events/second, multiple consumers, event replay requirements

### 3. Modular Monolith vs Microservices

**Chosen**: Modular monolith

**Alternative**: Separate services for API, underwriting, notifications

**Reasoning**:
- Domain is cohesive (all about bond applications)
- Shared database simplifies transactions
- Easier deployment and testing
- Lower operational overhead
- Can split later if needed

**When Microservices Make Sense**: Different services have independent scaling needs, different teams own services, polyglot persistence required

### 4. BullMQ vs AWS SQS/RabbitMQ

**Chosen**: BullMQ with Redis

**Alternative**: AWS SQS, RabbitMQ, or cloud-native queues

**Reasoning**:
- BullMQ has excellent Node.js integration
- Built-in retry and backoff
- Job progress tracking
- Lower cost than cloud queues for small scale
- Easy local development

**When SQS Makes Sense**: Already on AWS, need serverless, > 100k messages/day

## Deployment Architecture

### Development

```
Developer Machine
├── Node.js (API + Workers)
├── PostgreSQL (Docker)
└── Redis (Docker)
```

### Production (Current)

```
Docker Compose
├── App Container (Express API)
├── Worker Container (BullMQ workers)
├── PostgreSQL Container
└── Redis Container
```

### Production (Scaled)

```
Kubernetes Cluster
├── API Pods (3+ replicas, autoscaling)
├── Worker Pods (5+ replicas, autoscaling)
├── PostgreSQL (managed RDS/CloudSQL)
├── Redis (managed ElastiCache/MemoryStore)
├── Load Balancer
└── Ingress Controller
```

## Conclusion

This architecture prioritizes:
1. **Reliability**: Outbox pattern, idempotency, retry logic
2. **Observability**: Structured logging, correlation IDs, health checks
3. **Simplicity**: Modular monolith, proven patterns
4. **Evolvability**: Clear module boundaries allow future splitting

The system handles the current scale well and has clear evolution paths for 10x, 50x, and 100x growth.
