import { Router } from 'express';
import { ApplicationController } from './application.controller';

const router = Router();
const controller = new ApplicationController();

router.post('/', (req, res, next) => controller.createApplication(req, res, next));
router.get('/:applicationId', (req, res, next) => controller.getApplication(req, res, next));

export default router;
