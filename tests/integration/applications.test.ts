import request from 'supertest';
import { createApp } from '../../src/app';
import { prisma } from '../../src/infrastructure/prisma/client';
import { BondType } from '../../src/modules/applications/application.types';

describe('Applications API Integration Tests', () => {
  const app = createApp();

  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.idempotencyRecord.deleteMany();
    await prisma.decisionFactor.deleteMany();
    await prisma.outboxEvent.deleteMany();
    await prisma.applicantSnapshot.deleteMany();
    await prisma.application.deleteMany();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.idempotencyRecord.deleteMany();
    await prisma.decisionFactor.deleteMany();
    await prisma.outboxEvent.deleteMany();
    await prisma.applicantSnapshot.deleteMany();
    await prisma.application.deleteMany();
  });

  describe('POST /applications', () => {
    const validPayload = {
      applicantId: 'COMP-123',
      bondType: BondType.CONTRACT,
      bondAmount: 500000,
      effectiveDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
      obligee: {
        name: 'ABC Construction LLC',
      },
    };

    it('should create a new application successfully', async () => {
      const response = await request(app)
        .post('/applications')
        .send(validPayload)
        .expect(201);

      expect(response.body).toHaveProperty('applicationId');
      expect(response.body).toHaveProperty('status', 'PENDING');
      expect(response.body).toHaveProperty('requestId');
      expect(response.body.applicationId).toMatch(/^APP-/);
    });

    it('should return X-Request-Id header', async () => {
      const response = await request(app)
        .post('/applications')
        .send(validPayload)
        .expect(201);

      expect(response.headers).toHaveProperty('x-request-id');
    });

    it('should reject request with missing applicantId', async () => {
      const payload = { ...validPayload };
      delete (payload as Partial<typeof validPayload>).applicantId;

      const response = await request(app)
        .post('/applications')
        .send(payload)
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject request with invalid bondType', async () => {
      const payload = { ...validPayload, bondType: 'INVALID' };

      const response = await request(app)
        .post('/applications')
        .send(payload)
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject request with negative bondAmount', async () => {
      const payload = { ...validPayload, bondAmount: -1000 };

      const response = await request(app)
        .post('/applications')
        .send(payload)
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject request with past effectiveDate', async () => {
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
      const payload = { ...validPayload, effectiveDate: yesterday };

      const response = await request(app)
        .post('/applications')
        .send(payload)
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should persist application to database', async () => {
      const response = await request(app)
        .post('/applications')
        .send(validPayload)
        .expect(201);

      const application = await prisma.application.findUnique({
        where: { applicationId: response.body.applicationId },
      });

      expect(application).not.toBeNull();
      expect(application?.applicantId).toBe(validPayload.applicantId);
      expect(application?.status).toBe('PENDING');
    });
  });

  describe('GET /applications/:applicationId', () => {
    it('should return application details', async () => {
      const createResponse = await request(app)
        .post('/applications')
        .send({
          applicantId: 'COMP-123',
          bondType: BondType.CONTRACT,
          bondAmount: 500000,
          effectiveDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
          obligee: {
            name: 'ABC Construction LLC',
          },
        })
        .expect(201);

      const applicationId = createResponse.body.applicationId;

      const response = await request(app)
        .get(`/applications/${applicationId}`)
        .expect(200);

      expect(response.body).toHaveProperty('applicationId', applicationId);
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('applicantId', 'COMP-123');
      expect(response.body).toHaveProperty('bondType', 'CONTRACT');
      expect(response.body).toHaveProperty('bondAmount', 500000);
      expect(response.body).toHaveProperty('createdAt');
      expect(response.body).toHaveProperty('updatedAt');
    });

    it('should return 404 for non-existent application', async () => {
      const response = await request(app)
        .get('/applications/APP-NONEXISTENT')
        .expect(404);

      expect(response.body.error.code).toBe('NOT_FOUND');
    });

    it('should include applicant snapshot when available', async () => {
      const createResponse = await request(app)
        .post('/applications')
        .send({
          applicantId: 'COMP-123',
          bondType: BondType.CONTRACT,
          bondAmount: 500000,
          effectiveDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
          obligee: {
            name: 'ABC Construction LLC',
          },
        })
        .expect(201);

      const applicationId = createResponse.body.applicationId;

      await prisma.applicantSnapshot.create({
        data: {
          applicationId,
          applicantId: 'COMP-123',
          annualRevenue: 12000000,
          yearsInBusiness: 8,
          creditScore: 760,
          existingExposure: 1500000,
        },
      });

      const response = await request(app)
        .get(`/applications/${applicationId}`)
        .expect(200);

      expect(response.body.applicant).not.toBeNull();
      expect(response.body.applicant.annualRevenue).toBe(12000000);
    });
  });

  describe('Idempotency', () => {
    const validPayload = {
      applicantId: 'COMP-123',
      bondType: BondType.CONTRACT,
      bondAmount: 500000,
      effectiveDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
      obligee: {
        name: 'ABC Construction LLC',
      },
    };

    it('should return same response for duplicate request with same idempotency key', async () => {
      const idempotencyKey = 'test-key-12345';

      const response1 = await request(app)
        .post('/applications')
        .set('Idempotency-Key', idempotencyKey)
        .send(validPayload)
        .expect(201);

      const response2 = await request(app)
        .post('/applications')
        .set('Idempotency-Key', idempotencyKey)
        .send(validPayload)
        .expect(201);

      expect(response1.body.applicationId).toBe(response2.body.applicationId);
      expect(response1.body.status).toBe(response2.body.status);
    });

    it('should only create one application for duplicate requests', async () => {
      const idempotencyKey = 'test-key-unique-123';

      const response1 = await request(app)
        .post('/applications')
        .set('Idempotency-Key', idempotencyKey)
        .send(validPayload)
        .expect(201);

      await request(app)
        .post('/applications')
        .set('Idempotency-Key', idempotencyKey)
        .send(validPayload)
        .expect(201);

      const applications = await prisma.application.findMany({
        where: { applicationId: response1.body.applicationId },
      });

      expect(applications).toHaveLength(1);
    });

    it('should reject same idempotency key with different payload', async () => {
      const idempotencyKey = 'test-key-conflict-456';

      await request(app)
        .post('/applications')
        .set('Idempotency-Key', idempotencyKey)
        .send(validPayload)
        .expect(201);

      const differentPayload = {
        ...validPayload,
        bondAmount: 600000,
      };

      const response = await request(app)
        .post('/applications')
        .set('Idempotency-Key', idempotencyKey)
        .send(differentPayload)
        .expect(409);

      expect(response.body.error.code).toBe('CONFLICT');
    });

    it('should create different applications without idempotency key', async () => {
      const response1 = await request(app)
        .post('/applications')
        .send(validPayload)
        .expect(201);

      const response2 = await request(app)
        .post('/applications')
        .send(validPayload)
        .expect(201);

      expect(response1.body.applicationId).not.toBe(response2.body.applicationId);
    });
  });

  describe('Health Endpoints', () => {
    it('GET /health should return healthy status', async () => {
      const response = await request(app).get('/health').expect(200);

      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
    });

    it('GET /ready should check dependencies', async () => {
      const response = await request(app).get('/ready');

      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('checks');
      expect(response.body.checks).toHaveProperty('database');
      expect(response.body.checks).toHaveProperty('redis');
    });
  });
});
