import { Response } from 'express';
import { z } from 'zod';
import { prisma } from '../services/db.service';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

const taskSchema = z.object({
  title: z.string().min(2, 'Task title must be at least 2 characters'),
  description: z.string().optional(),
  priority: z.enum(['HIGH', 'MEDIUM', 'LOW']).default('MEDIUM'),
  status: z.enum(['NOT_STARTED', 'IN_PROGRESS', 'UNDER_REVIEW', 'COMPLETED', 'CANCELLED']).default('NOT_STARTED'),
  assignedTo: z.string().uuid().nullable().optional(),
  dueDate: z.string().optional().transform(val => val ? new Date(val) : undefined),
  estimatedHours: z.number().int().nonnegative().optional()
});

const updateTaskSchema = z.object({
  title: z.string().min(2).optional(),
  description: z.string().optional(),
  priority: z.enum(['HIGH', 'MEDIUM', 'LOW']).optional(),
  status: z.enum(['NOT_STARTED', 'IN_PROGRESS', 'UNDER_REVIEW', 'COMPLETED', 'CANCELLED']).optional(),
  assignedTo: z.string().uuid().nullable().optional(),
  dueDate: z.string().optional().transform(val => val ? new Date(val) : undefined),
  estimatedHours: z.number().int().nonnegative().optional(),
  actualHours: z.number().int().nonnegative().optional()
});

// Helper to log project activity
async function logActivity(projectId: string, userId: string, action: string, entityType: string, entityId?: string, metadata?: any) {
  try {
    await prisma.activityLog.create({
      data: {
        projectId,
        userId,
        action,
        entityType,
        entityId,
        metadata: metadata ? JSON.stringify(metadata) : undefined
      }
    });
  } catch (err) {
    console.error('Activity log error:', err);
  }
}

// Helper to notify user
async function notifyUser(userId: string, title: string, message: string, type: string) {
  try {
    await prisma.notification.create({
      data: { userId, title, message, type }
    });
  } catch (err) {
    console.error('Notification log error:', err);
  }
}

export const createTask = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { projectId } = req.params;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const parseResult = taskSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: parseResult.error.flatten().fieldErrors
      });
    }

    // Verify sender membership
    const membership = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } }
    });

    if (!membership) {
      return res.status(403).json({ success: false, message: 'You are not a member of this project' });
    }

    const { title, description, priority, status, assignedTo, dueDate, estimatedHours } = parseResult.data;

    // Create task
    const task = await prisma.task.create({
      data: {
        projectId,
        title,
        description,
        priority,
        status,
        assignedTo: assignedTo || null,
        createdBy: userId,
        dueDate,
        estimatedHours
      },
      include: {
        assignee: { select: { id: true, fullName: true, username: true } }
      }
    });

    await logActivity(projectId, userId, 'TASK_CREATED', 'TASK', task.id, { title });

    // Send notifications if assigned to someone else
    if (assignedTo && assignedTo !== userId) {
      const project = await prisma.project.findUnique({ where: { id: projectId }, select: { name: true } });
      await notifyUser(
        assignedTo,
        'New Task Assigned',
        `You have been assigned to task: "${title}" in project: ${project?.name || 'Academic Module'}`,
        'TASK_ASSIGNED'
      );
    }

    // Broadcast socket event
    const io = req.app.get('io');
    if (io) {
      io.to(projectId).emit('task-created', task);
    }

    return res.status(201).json({
      success: true,
      task
    });
  } catch (error) {
    console.error('Create task error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const updateTask = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { taskId } = req.params;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const parseResult = updateTaskSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: parseResult.error.flatten().fieldErrors
      });
    }

    // Fetch existing task
    const existingTask = await prisma.task.findUnique({
      where: { id: taskId }
    });

    if (!existingTask) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    // Check project membership
    const membership = await prisma.projectMember.findUnique({
      where: {
        projectId_userId: { projectId: existingTask.projectId, userId }
      }
    });

    if (!membership) {
      return res.status(403).json({ success: false, message: 'You are not a member of this project' });
    }

    const updateData = parseResult.data;

    // Check completed state transitions
    let completedAt = existingTask.completedAt;
    if (updateData.status === 'COMPLETED' && existingTask.status !== 'COMPLETED') {
      completedAt = new Date();
      await logActivity(existingTask.projectId, userId, 'TASK_COMPLETED', 'TASK', taskId, { title: existingTask.title });
    } else if (updateData.status && updateData.status !== 'COMPLETED') {
      completedAt = null;
    }

    const updatedTask = await prisma.task.update({
      where: { id: taskId },
      data: {
        ...updateData,
        completedAt
      },
      include: {
        assignee: { select: { id: true, fullName: true, username: true } }
      }
    });

    await logActivity(existingTask.projectId, userId, 'TASK_UPDATED', 'TASK', taskId, updateData);

    // Notify new assignee if changed
    if (updateData.assignedTo && updateData.assignedTo !== existingTask.assignedTo && updateData.assignedTo !== userId) {
      const project = await prisma.project.findUnique({ where: { id: existingTask.projectId }, select: { name: true } });
      await notifyUser(
        updateData.assignedTo,
        'Task Assigned to You',
        `You have been assigned to task: "${updatedTask.title}" in project: ${project?.name || 'Academic Module'}`,
        'TASK_ASSIGNED'
      );
    }

    // Broadcast socket event
    const io = req.app.get('io');
    if (io) {
      io.to(existingTask.projectId).emit('task-updated', updatedTask);
    }

    return res.status(200).json({
      success: true,
      task: updatedTask
    });
  } catch (error) {
    console.error('Update task error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const deleteTask = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { taskId } = req.params;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    // Verify project membership
    const membership = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: task.projectId, userId } }
    });

    if (!membership) {
      return res.status(403).json({ success: false, message: 'You are not a member of this project' });
    }

    await prisma.task.delete({ where: { id: taskId } });

    await logActivity(task.projectId, userId, 'TASK_DELETED', 'TASK', taskId, { title: task.title });

    // Broadcast socket event
    const io = req.app.get('io');
    if (io) {
      io.to(task.projectId).emit('task-deleted', { taskId });
    }

    return res.status(200).json({
      success: true,
      message: 'Task deleted successfully'
    });
  } catch (error) {
    console.error('Delete task error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
