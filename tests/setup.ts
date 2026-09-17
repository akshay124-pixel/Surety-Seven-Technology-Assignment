import { loadConfig } from '../src/config/env';

process.env.NODE_ENV = 'test';
process.env.PORT = '3001';
process.env.LOG_LEVEL = 'error';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/suretyseven_test?schema=public';
process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
process.env.APPLICANT_API_URL = 'http://localhost:3001/external/applicants';
process.env.APPLICANT_API_TIMEOUT_MS = '5000';
process.env.APPLICANT_API_MAX_RETRIES = '3';
process.env.DOWNSTREAM_API_URL = 'http://localhost:3001/external/downstream/events';
process.env.DOWNSTREAM_API_TIMEOUT_MS = '5000';
process.env.DOWNSTREAM_API_MAX_RETRIES = '5';

loadConfig();

jest.setTimeout(30000);
