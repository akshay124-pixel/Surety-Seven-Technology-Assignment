-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('PENDING', 'EVALUATING', 'APPROVED', 'REFERRED', 'DECLINED', 'FAILED');

-- CreateEnum
CREATE TYPE "BondType" AS ENUM ('CONTRACT', 'COMMERCIAL', 'COURT', 'FIDELITY', 'LICENSE_PERMIT');

-- CreateEnum
CREATE TYPE "OutboxEventStatus" AS ENUM ('PENDING', 'PROCESSING', 'DELIVERED', 'FAILED');

-- CreateTable
CREATE TABLE "applications" (
    "id" TEXT NOT NULL,
    "application_id" TEXT NOT NULL,
    "applicant_id" TEXT NOT NULL,
    "bond_type" "BondType" NOT NULL,
    "bond_amount" DECIMAL(15,2) NOT NULL,
    "effective_date" DATE NOT NULL,
    "obligee_name" TEXT NOT NULL,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'PENDING',
    "score" INTEGER,
    "decision" TEXT,
    "failure_code" TEXT,
    "failure_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "applicant_snapshots" (
    "id" TEXT NOT NULL,
    "application_id" TEXT NOT NULL,
    "applicant_id" TEXT NOT NULL,
    "annual_revenue" DECIMAL(15,2) NOT NULL,
    "years_in_business" INTEGER NOT NULL,
    "credit_score" INTEGER NOT NULL,
    "existing_exposure" DECIMAL(15,2) NOT NULL,
    "retrieved_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "applicant_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "decision_factors" (
    "id" TEXT NOT NULL,
    "application_id" TEXT NOT NULL,
    "factor" TEXT NOT NULL,
    "input_value" TEXT NOT NULL,
    "rule" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "explanation" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "decision_factors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbox_events" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "application_id" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "OutboxEventStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "available_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "delivered_at" TIMESTAMP(3),

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_records" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "request_hash" TEXT NOT NULL,
    "application_id" TEXT NOT NULL,
    "response_data" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "idempotency_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "applications_application_id_key" ON "applications"("application_id");

-- CreateIndex
CREATE INDEX "applications_applicant_id_idx" ON "applications"("applicant_id");

-- CreateIndex
CREATE INDEX "applications_status_idx" ON "applications"("status");

-- CreateIndex
CREATE INDEX "applications_created_at_idx" ON "applications"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "applicant_snapshots_application_id_key" ON "applicant_snapshots"("application_id");

-- CreateIndex
CREATE INDEX "applicant_snapshots_applicant_id_idx" ON "applicant_snapshots"("applicant_id");

-- CreateIndex
CREATE INDEX "decision_factors_application_id_idx" ON "decision_factors"("application_id");

-- CreateIndex
CREATE UNIQUE INDEX "outbox_events_event_id_key" ON "outbox_events"("event_id");

-- CreateIndex
CREATE INDEX "outbox_events_status_available_at_idx" ON "outbox_events"("status", "available_at");

-- CreateIndex
CREATE INDEX "outbox_events_application_id_idx" ON "outbox_events"("application_id");

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_records_key_key" ON "idempotency_records"("key");

-- CreateIndex
CREATE INDEX "idempotency_records_expires_at_idx" ON "idempotency_records"("expires_at");

-- AddForeignKey
ALTER TABLE "applicant_snapshots" ADD CONSTRAINT "applicant_snapshots_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("application_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decision_factors" ADD CONSTRAINT "decision_factors_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("application_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbox_events" ADD CONSTRAINT "outbox_events_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("application_id") ON DELETE CASCADE ON UPDATE CASCADE;
