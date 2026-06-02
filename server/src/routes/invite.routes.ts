import { Router } from 'express';
import { getPendingInvitations, respondToInvitation } from '../controllers/invite.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticateToken);

router.get('/pending', getPendingInvitations);
router.put('/:invitationId/respond', respondToInvitation);

export default router;
