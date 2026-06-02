import { Router } from 'express';
import { logStudySession, getStudyStats } from '../controllers/study.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticateToken);

router.post('/', logStudySession);
router.get('/stats', getStudyStats);

export default router;
