import { Router } from 'express';
import { 
  createProject, getProjects, getProjectById, 
  updateProject, deleteProject, removeMember, updateMemberRole 
} from '../controllers/project.controller';
import { sendInvitation } from '../controllers/invite.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

// Secure all project endpoints
router.use(authenticateToken);

router.post('/', createProject);
router.get('/', getProjects);
router.get('/:projectId', getProjectById);
router.put('/:projectId', updateProject);
router.delete('/:projectId', deleteProject);

// Members and roles
router.delete('/:projectId/members/:targetUserId', removeMember);
router.put('/:projectId/members/:targetUserId/role', updateMemberRole);

// Send invites from within project path
router.post('/:projectId/invites', sendInvitation);

// Chat & Messages routes
import { sendMessage, getMessages } from '../controllers/chat.controller';
router.post('/:projectId/messages', sendMessage);
router.get('/:projectId/messages', getMessages);

// Tasks routes
import { createTask, updateTask, deleteTask } from '../controllers/task.controller';
router.post('/:projectId/tasks', createTask);
router.put('/:projectId/tasks/:taskId', updateTask);
router.delete('/:projectId/tasks/:taskId', deleteTask);

// Files routes
import { uploadMiddleware, uploadFile, getProjectFiles, deleteFile } from '../controllers/file.controller';
router.post('/:projectId/files', uploadMiddleware, uploadFile);
router.get('/:projectId/files', getProjectFiles);
router.delete('/:projectId/files/:fileId', deleteFile);

export default router;
