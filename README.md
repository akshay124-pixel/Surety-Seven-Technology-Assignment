# SuretySeven Surety Bond Application Processing System

A production-ready surety bond application processing system with automated underwriting, reliable event handling, and comprehensive failure recovery.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Technology Stack](#technology-stack)
- [Key Features](#key-features)
- [Getting Started](#getting-started)
- [API Documentation](#api-documentation)
- [Failure Simulation](#failure-simulation)
- [Testing](#testing)
- [Design Decisions](#design-decisions)
- [Trade-offs](#trade-offs)
- [Future Enhancements](#future-enhancements)
- [Scaling to 100x Traffic](#scaling-to-100x-traffic)

## Overview

This system processes surety bond applications through an automated underwriting pipeline. It accepts applications via REST API, retrieves applicant information from an external service, calculates risk scores using deterministic rules, and notifies downstream systems of final decisions.

### Problem Interpretation

The system must:
1. Accept bond applications and return quickly without blocking on external dependencies
2. Fetch applicant data from an external API with proper retry and timeout handling
3. Calculate underwriting scores using transparent, deterministic rules
4. Handle external service failures gracefully without losing data
5. Prevent duplicate processing when clients retry requests
6. Reliably notify downstream systems even if they're temporarily unavailable
7. Provide observability through structured logging and correlation IDs

## Architecture

The system uses a **modular monolith** architecture with asynchronous background processing:

```
┌─────────────────────────────────────────────────────────────┐
│                         Client                              │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
          ┌──────────────────────────────┐
          │       Express REST API       │
          │    (POST /applications)      │
          └──────────┬───────────────────┘
                     │
                     ▼
          ┌──────────────────────────────┐
          │   Idempotency Check (DB)     │◄─── Prevents duplicates
          └──────────┬───────────────────┘
                     │
                     ▼
          ┌──────────────────────────────┐
          │  Create Application (PENDING)│
          │    + Enqueue Evaluation      │
          └──────────┬───────────────────┘
                     │
                     ├─────► PostgreSQL (Application persisted)
                     │
                     └─────► Redis/BullMQ (Job queued)
                     
                     
  ┌─────────────────────────────────────────────────────────┐
  │                   Background Worker                     │
  └──────────────────┬──────────────────────────────────────┘
                     │
                     ▼
          ┌──────────────────────────────┐
          │  Fetch Applicant Info        │
          │  (with retry + timeout)      │◄─── External Applicant API
          └──────────┬───────────────────┘
                     │
                     ▼
          ┌──────────────────────────────┐
          │  Underwriting Engine         │
          │  (deterministic scoring)     │
          └──────────┬───────────────────┘
                     │
                     ▼
          ┌──────────────────────────────┐
          │  Persist Decision + Create   │
          │  Outbox Event (Transaction)  │
          └──────────┬───────────────────┘
                     │
                     └─────► PostgreSQL (Decision + Outbox)
                     
                     
  ┌─────────────────────────────────────────────────────────┐
  │               Notification Worker                       │
  └──────────────────┬────────────────────────────────────────┘
                     │
                     ▼
          ┌──────────────────────────────┐
          │  Poll Outbox for Events      │
          └──────────┬───────────────────┘
                     │
                     ▼
          ┌──────────────────────────────┐
          │  Send to Downstream API      │
          │  (with retry)                │◄─── External Downstream API
          └──────────┬───────────────────┘
                     │
                     └─────► Mark as DELIVERED
```

### Key Architectural Patterns

1. **Outbox Pattern**: Final decisions are persisted atomically with outbox events in a single transaction, ensuring reliable downstream notification even if the system crashes.

2. **Idempotency**: Database-backed idempotency keys prevent duplicate applications when clients retry requests.

3. **Background Processing**: External API calls and underwriting happen asynchronously, so the POST endpoint returns quickly.

4. **Retry with Backoff**: Both applicant data fetching and downstream notifications use exponential backoff with bounded retries.

5. **State Machine**: Applications transition through explicit states (PENDING → EVALUATING → APPROVED/REFERRED/DECLINED/FAILED).

## Technology Stack

### Backend
- **Node.js 18** with **TypeScript** for type safety
- **Express** for REST API
- **Prisma** ORM with **PostgreSQL** for data persistence
- **BullMQ** with **Redis** for job queues
- **Zod** for request validation
- **Pino** for structured JSON logging

### Infrastructure
- **Docker** and **Docker Compose** for containerization
- **PostgreSQL 15** for relational data
- **Redis 7** for queue management

### Testing
- **Jest** with **Supertest** for unit and integration tests
- **ts-jest** for TypeScript support

### Why These Choices?

**PostgreSQL**: ACID transactions ensure consistency between application state, outbox events, and idempotency records. Relational model naturally fits the domain.

**Redis + BullMQ**: Reliable job queue with automatic retry, exponential backoff, and graceful failure handling. BullMQ provides better observability than raw Redis.

**Modular Monolith**: Simpler to deploy, test, and reason about than microservices. Can be split later if domain boundaries justify it. All reliability features (outbox, idempotency) work without distributed transactions.

**Prisma**: Type-safe database access, automatic migrations, and excellent TypeScript integration. Schema-first approach keeps database design explicit.

## Key Features

### 1. Idempotent Request Handling

Clients can include an `Idempotency-Key` header. The system:
- Returns the same response for duplicate requests with the same key and payload
- Rejects requests with the same key but different payload (409 Conflict)
- Uses database uniqueness constraints to prevent race conditions

### 2. Deterministic Underwriting

Scoring rules are transparent and deterministic:

| Factor | Condition | Points |
|--------|-----------|--------|
| Credit Score | >= 750 | 30 |
| Credit Score | 700-749 | 20 |
| Credit Score | < 700 | 5 |
| Years in Business | >= 5 | 20 |
| Years in Business | < 5 | 10 |
| Bond/Revenue Ratio | <= 10% | 30 |
| Bond/Revenue Ratio | > 10% | 10 |
| Exposure/Revenue | < 20% | 20 |
| Exposure/Revenue | >= 20% | 5 |

**Decision Logic**:
- Score >= 80: **APPROVED**
- Score 50-79: **REFERRED**
- Score < 50: **DECLINED**

### 3. Graceful Failure Handling

**Applicant API Failures**:
- Timeout: Retry with exponential backoff (up to 3 attempts)
- 5xx errors: Retry
- Malformed response: Mark as FAILED (no retry)
- Network errors: Retry

**Downstream API Failures**:
- Decision is already persisted before notification attempt
- Notification failures trigger retry with exponential backoff (up to 5 attempts)
- Application state remains correct even if notifications fail

### 4. Crash Recovery

- Application state is persisted in PostgreSQL before responding
- Background jobs can be retried if worker crashes
- Outbox events are processed separately from decision persistence
- No in-memory state is required for correctness

### 5. Observability

- Structured JSON logs with correlation IDs
- Request IDs propagate through entire request lifecycle
- Health and readiness endpoints for monitoring
- No sensitive data (credentials, tokens) in logs

## Getting Started

### Prerequisites

- Docker and Docker Compose
- Node.js 18+ (for local development)

### Running with Docker (Recommended)

```bash
# Clone repository
git clone <repository-url>
cd suretyseven-bond-application

# Start all services
docker compose up --build

# The API will be available at http://localhost:3000
```

Services:
- **API**: http://localhost:3000
- **PostgreSQL**: localhost:5432
- **Redis**: localhost:6379

### Running Locally

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Edit .env with your database connection

# Generate Prisma client
npm run prisma:generate

# Run migrations
npm run prisma:migrate

# Start PostgreSQL and Redis
docker compose up postgres redis -d

# Start API server
npm run dev

# In another terminal, start workers
npm run worker
```

### Environment Variables

See `.env.example` for all configuration options. Key variables:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/suretyseven
REDIS_URL=redis://localhost:6379
APPLICANT_API_URL=http://localhost:3000/external/applicants
DOWNSTREAM_API_URL=http://localhost:3000/external/downstream/events
```

## API Documentation

### POST /applications

Create a new bond application.

**Request**:
```json
POST /applications
Content-Type: application/json
Idempotency-Key: optional-unique-key

{
  "applicantId": "COMP-123",
  "bondType": "CONTRACT",
  "bondAmount": 500000,
  "effectiveDate": "2026-10-01",
  "obligee": {
    "name": "ABC Construction LLC"
  }
}
```

**Valid Bond Types**: `CONTRACT`, `COMMERCIAL`, `COURT`, `FIDELITY`, `LICENSE_PERMIT`

**Response** (201 Created):
```json
{
  "applicationId": "APP-M1N2O3P4Q5",
  "status": "PENDING",
  "requestId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Error Responses**:
- `400`: Validation error
- `409`: Idempotency key conflict
- `429`: Rate limit exceeded
- `500`: Internal server error

### GET /applications/:applicationId

Retrieve application status and details.

**Request**:
```
GET /applications/APP-M1N2O3P4Q5
```

**Response** (200 OK):
```json
{
  "applicationId": "APP-M1N2O3P4Q5",
  "status": "APPROVED",
  "applicantId": "COMP-123",
  "bondType": "CONTRACT",
  "bondAmount": 500000,
  "effectiveDate": "2026-10-01",
  "obligeeName": "ABC Construction LLC",
  "score": 100,
  "decision": "APPROVE",
  "applicant": {
    "applicantId": "COMP-123",
    "annualRevenue": 12000000,
    "yearsInBusiness": 8,
    "creditScore": 760,
    "existingExposure": 1500000
  },
  "decisionFactors": [
    {
      "factor": "CREDIT_SCORE",
      "value": "760",
      "points": 30,
      "explanation": "Excellent credit score (>= 750)"
    },
    {
      "factor": "YEARS_IN_BUSINESS",
      "value": "8",
      "points": 20,
      "explanation": "Established business (>= 5 years)"
    },
    {
      "factor": "BOND_TO_REVENUE_RATIO",
      "value": "4.17%",
      "points": 30,
      "explanation": "Low risk: Bond is 4.2% of annual revenue (<= 10%)"
    },
    {
      "factor": "EXPOSURE_TO_REVENUE_RATIO",
      "value": "12.50%",
      "points": 20,
      "explanation": "Low exposure: 12.5% of annual revenue (< 20%)"
    }
  ],
  "createdAt": "2026-09-17T10:30:00.000Z",
  "updatedAt": "2026-09-17T10:30:05.000Z"
}
```

**Error Responses**:
- `404`: Application not found

### GET /health

Basic health check.

**Response** (200 OK):
```json
{
  "status": "healthy",
  "timestamp": "2026-09-17T10:30:00.000Z",
  "uptime": 12345
}
```

### GET /ready

Readiness check with dependency status.

**Response** (200 OK if ready, 503 if not):
```json
{
  "status": "ready",
  "checks": {
    "database": { "status": "connected" },
    "redis": { "status": "connected" }
  },
  "timestamp": "2026-09-17T10:30:00.000Z"
}
```

## Failure Simulation

The system includes mock external APIs that support deterministic failure simulation for testing and demonstration.

### Mock Applicant API

Special applicant IDs trigger different behaviors:

| Applicant ID | Behavior |
|--------------|----------|
| `COMP-123` | Success (high score) |
| `COMP-456` | Success (medium score) |
| `COMP-LOW` | Success (low score) |
| `COMP-TIMEOUT` | Timeout (no response) |
| `COMP-500` | Server error (500) |
| `COMP-MALFORMED` | Malformed response |
| `COMP-SLOW` | Slow response (3s delay) |

**Example**:
```bash
curl -X POST http://localhost:3000/applications \
  -H "Content-Type: application/json" \
  -d '{
    "applicantId": "COMP-TIMEOUT",
    "bondType": "CONTRACT",
    "bondAmount": 500000,
    "effectiveDate": "2026-10-01",
    "obligee": {"name": "Test Company"}
  }'
```

This will trigger retry logic and eventually mark the application as FAILED.

### Mock Downstream API

Applications with special patterns in their IDs trigger failures:

| Pattern | Behavior |
|---------|----------|
| Normal | Success |
| `DOWNSTREAM-500` | Server error |
| `DOWNSTREAM-TIMEOUT` | Timeout |
| `DOWNSTREAM-SLOW` | Slow response |

The downstream API is idempotent based on `eventId`.

## Testing

### Run All Tests

```bash
npm test
```

### Run Unit Tests Only

```bash
npm test -- tests/unit
```

### Run Integration Tests

```bash
npm test -- tests/integration
```

### Test Coverage

```bash
npm run test:coverage
```

### What's Tested

**Unit Tests**:
- Underwriting engine scoring rules at all boundaries
- Decision logic (approve/refer/decline thresholds)
- Hash and ID generation utilities
- Request validation schemas
- State machine transitions

**Integration Tests**:
- POST /applications with valid/invalid payloads
- GET /applications with existing/missing IDs
- Idempotency behavior (same key, different payload, no key)
- Health and readiness endpoints
- Database persistence

## Design Decisions

### 1. Why Modular Monolith?

**Rationale**: The domain is cohesive, and splitting into microservices would add complexity without clear benefits:
- No independent scaling requirements for different components
- All features share the same database
- Simpler deployment and testing
- Easier to implement transactional outbox pattern

**When to split**: If underwriting rules become complex enough to require independent deployment, or if different bond types need separate processing pipelines.

### 2. Why Outbox Pattern?

**Problem**: Dual-write problem—if we update the database and then call the downstream API, a crash between those operations causes lost notifications.

**Solution**: Store the notification event in the database within the same transaction as the decision. A separate worker polls and processes events.

**Benefit**: "At-least-once" delivery with database consistency guarantees.

### 3. Why Database-Backed Idempotency?

**Problem**: In-memory Maps lose state on restart and don't work across multiple instances.

**Solution**: Store idempotency keys in PostgreSQL with unique constraints.

**Benefit**: Handles concurrent duplicate requests and survives restarts.

### 4. Why BullMQ Instead of Direct Redis?

**Rationale**:
- Automatic retry with exponential backoff
- Job progress tracking
- Failed job retention for debugging
- Structured job data
- Better observability

**Cost**: Additional dependency, but worth it for reliability.

### 5. Why Separate Evaluation and Notification Workers?

**Rationale**:
- Different retry strategies (evaluation: 3 retries, notification: 5 retries)
- Different failure semantics
- Independent scaling of evaluation vs notification throughput
- Clearer separation of concerns

## Trade-offs

### 1. Eventual Consistency

**Trade-off**: Application status is eventually consistent. After POST returns, the application is PENDING, not immediately decided.

**Why**: Synchronous external API calls would block the request and couple our uptime to the external service's uptime.

**Mitigation**: Clear API design—status field indicates current state, clients can poll for final decision.

### 2. At-Least-Once Delivery

**Trade-off**: Downstream systems may receive duplicate events if delivery confirmation fails after successful send.

**Why**: Exactly-once delivery requires distributed transactions or complex consensus, which adds significant complexity.

**Mitigation**: Events include unique `eventId`, downstream systems should be idempotent.

### 3. Polling Outbox

**Trade-off**: Outbox events are polled every 5 seconds, adding slight delay.

**Why**: Simpler than change data capture (CDC) or database triggers.

**Mitigation**: Acceptable for most use cases; can be tuned to 1-2 seconds if needed.

### 4. In-Process Mock APIs

**Trade-off**: Mock external APIs run in the same process as the application.

**Why**: Simplifies development and testing without additional infrastructure.

**Mitigation**: In production, these would be actual external services.

## Future Enhancements

Given more time, I would add:

### Short Term (1-2 weeks)
1. **OpenAPI/Swagger documentation** for interactive API exploration
2. **Metrics and monitoring** (Prometheus, Grafana)
3. **Dead letter queue** for permanently failed events
4. **Admin API** for viewing failed jobs and retrying manually
5. **Webhook support** for clients to receive real-time notifications
6. **More comprehensive test scenarios** (concurrent requests, worker crashes)

### Medium Term (1 month)
1. **Pagination** for listing applications
2. **Search and filtering** by status, date range, applicant
3. **Audit log** of all state transitions
4. **Configurable underwriting rules** without code changes
5. **Performance optimization** (connection pooling, query optimization)
6. **Rate limiting per applicant** to prevent abuse

### Long Term (3+ months)
1. **Multi-tenancy** for different insurers
2. **ML-based risk scoring** alongside rule-based scoring
3. **Document upload and storage** for bond contracts
4. **Workflow engine** for manual review of REFERRED applications
5. **Real-time dashboards** for operations team

## Scaling to 100x Traffic

Current system handles ~100 requests/minute. At 100x scale (10,000 req/min), here's the evolution:

### Phase 1: Vertical Scaling (10x)
- **Database**: Increase PostgreSQL instance size, add read replicas
- **Workers**: Increase worker concurrency (currently 5 evaluation, 3 notification)
- **Redis**: Use Redis cluster for queue distribution
- **Estimated cost**: $500-1000/month

### Phase 2: Horizontal Scaling (50x)
- **API**: Run multiple Express instances behind load balancer
- **Workers**: Scale worker containers independently (K8s HPA)
- **Database**: Connection pooling (PgBouncer), partitioning by date
- **Caching**: Add Redis cache for GET requests
- **Estimated cost**: $2000-3000/month

### Phase 3: Architecture Evolution (100x)
- **Separate services**: Split if domain boundaries justify it
  - Application Service (POST /applications)
  - Query Service (GET /applications) with read replicas
  - Underwriting Service (evaluation worker)
  - Notification Service (outbox processing)
- **Event streaming**: Consider Kafka for high-throughput event distribution
- **Database**: Sharding by applicant region or bond type
- **CDN**: Static assets and cached responses
- **Estimated cost**: $5000-10000/month

### What Wouldn't Change
- **Core reliability patterns** (idempotency, outbox, retry) remain the same
- **PostgreSQL** can handle 100x with proper tuning
- **Modular monolith** is fine until 100x; premature microservices add complexity

### Key Metrics to Monitor
- API response time (p50, p95, p99)
- Queue depth and processing rate
- Database connection pool utilization
- Outbox event lag (time between creation and delivery)
- External API error rates

## License

MIT

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.
