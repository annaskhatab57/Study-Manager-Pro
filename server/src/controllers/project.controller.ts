import { Response } from 'express';
import { z } from 'zod';
import { prisma } from '../services/db.service';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

const projectSchema = z.object({
  name: z.string().min(2, 'Project name must be at least 2 characters'),
  description: z.string().optional(),
  category: z.string().optional(),
  visibility: z.enum(['PRIVATE', 'TEAM']).default('TEAM'),
  startDate: z.string().optional().transform(val => val ? new Date(val) : undefined),
  deadline: z.string().optional().transform(val => val ? new Date(val) : undefined)
});

const updateProjectSchema = z.object({
  name: z.string().min(2, 'Project name must be at least 2 characters').optional(),
  description: z.string().optional(),
  category: z.string().optional(),
  visibility: z.enum(['PRIVATE', 'TEAM']).optional(),
  status: z.enum(['ACTIVE', 'COMPLETED', 'ARCHIVED']).optional(),
  startDate: z.string().optional().transform(val => val ? new Date(val) : undefined),
  deadline: z.string().optional().transform(val => val ? new Date(val) : undefined)
});

const updateRoleSchema = z.object({
  role: z.enum(['OWNER', 'MEMBER', 'VIEWER'])
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
    console.error('Failed to create activity log:', err);
  }
}

export const createProject = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parseResult = projectSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: parseResult.error.flatten().fieldErrors
      });
    }

    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const { name, description, category, visibility, startDate, deadline } = parseResult.data;

    // Use transaction to create project & project member entry
    const project = await prisma.$transaction(async (tx) => {
      const newProj = await tx.project.create({
        data: {
          name,
          description,
          category,
          visibility,
          startDate,
          deadline,
          ownerId: userId,
          members: {
            create: {
              userId,
              role: 'OWNER'
            }
          }
        }
      });
      return newProj;
    });

    await logActivity(project.id, userId, 'PROJECT_CREATED', 'PROJECT', project.id);

    return res.status(201).json({
      success: true,
      project
    });
  } catch (error) {
    console.error('Create project error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const getProjects = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    // Fetch projects where the user is a member/owner
    const memberships = await prisma.projectMember.findMany({
      where: { userId },
      include: {
        project: {
          include: {
            owner: {
              select: { id: true, fullName: true, username: true, avatarUrl: true }
            },
            _count: {
              select: { members: true, tasks: true }
            }
          }
        }
      }
    });

    const projects = memberships.map(m => ({
      ...m.project,
      myRole: m.role
    }));

    return res.status(200).json({
      success: true,
      projects
    });
  } catch (error) {
    console.error('Get projects error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const getProjectById = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { projectId } = req.params;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const membership = await prisma.projectMember.findUnique({
      where: {
        projectId_userId: { projectId, userId }
      }
    });

    if (!membership) {
      return res.status(403).json({ success: false, message: 'You are not a member of this project' });
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        owner: {
          select: { id: true, fullName: true, username: true, avatarUrl: true }
        },
        members: {
          include: {
            user: {
              select: { id: true, fullName: true, username: true, email: true, avatarUrl: true }
            }
          }
        },
        tasks: {
          include: {
            assignee: {
              select: { id: true, fullName: true, username: true, avatarUrl: true }
            }
          }
        },
        activityLogs: {
          orderBy: { createdAt: 'desc' },
          take: 15,
          include: {
            user: {
              select: { fullName: true, username: true }
            }
          }
        }
      }
    });

    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    return res.status(200).json({
      success: true,
      project: {
        ...project,
        myRole: membership.role
      }
    });
  } catch (error) {
    console.error('Get project detail error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const updateProject = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { projectId } = req.params;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const parseResult = updateProjectSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: parseResult.error.flatten().fieldErrors
      });
    }

    const membership = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } }
    });

    if (!membership || membership.role !== 'OWNER') {
      return res.status(403).json({ success: false, message: 'Only the project owner can update settings' });
    }

    const updatedProject = await prisma.project.update({
      where: { id: projectId },
      data: parseResult.data
    });

    await logActivity(projectId, userId, 'PROJECT_UPDATED', 'PROJECT', projectId, parseResult.data);

    return res.status(200).json({
      success: true,
      project: updatedProject
    });
  } catch (error) {
    console.error('Update project error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const deleteProject = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { projectId } = req.params;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const membership = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } }
    });

    if (!membership || membership.role !== 'OWNER') {
      return res.status(403).json({ success: false, message: 'Only the project owner can delete the project' });
    }

    // Prisma Cascade deletion will remove members, tasks, logs, etc automatically
    await prisma.project.delete({
      where: { id: projectId }
    });

    return res.status(200).json({
      success: true,
      message: 'Project deleted successfully'
    });
  } catch (error) {
    console.error('Delete project error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const removeMember = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { projectId, targetUserId } = req.params;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const requesterMembership = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } }
    });

    if (!requesterMembership || requesterMembership.role !== 'OWNER') {
      return res.status(403).json({ success: false, message: 'Only the project owner can remove members' });
    }

    if (userId === targetUserId) {
      return res.status(400).json({ success: false, message: 'Owners cannot remove themselves. Assign another owner first or delete the project.' });
    }

    await prisma.projectMember.delete({
      where: {
        projectId_userId: { projectId, userId: targetUserId }
      }
    });

    await logActivity(projectId, userId, 'MEMBER_REMOVED', 'USER', targetUserId);

    return res.status(200).json({
      success: true,
      message: 'Member removed successfully'
    });
  } catch (error) {
    console.error('Remove member error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const updateMemberRole = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { projectId, targetUserId } = req.params;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const parseResult = updateRoleSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ success: false, message: 'Invalid role selection' });
    }

    const { role } = parseResult.data;

    const requesterMembership = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } }
    });

    if (!requesterMembership || requesterMembership.role !== 'OWNER') {
      return res.status(403).json({ success: false, message: 'Only the project owner can edit roles' });
    }

    // Update target membership
    const updatedMember = await prisma.projectMember.update({
      where: {
        projectId_userId: { projectId, userId: targetUserId }
      },
      data: { role }
    });

    await logActivity(projectId, userId, 'ROLE_UPDATED', 'USER', targetUserId, { role });

    return res.status(200).json({
      success: true,
      member: updatedMember
    });
  } catch (error) {
    console.error('Update member role error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
