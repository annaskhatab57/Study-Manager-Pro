import { Response } from 'express';
import { z } from 'zod';
import { prisma } from '../services/db.service';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

const inviteSchema = z.object({
  emailOrUsername: z.string().min(1, 'Email or username is required')
});

const responseSchema = z.object({
  action: z.enum(['ACCEPTED', 'REJECTED'])
});

// Helper for notifications creation
async function createNotification(userId: string, title: string, message: string, type: string) {
  try {
    await prisma.notification.create({
      data: { userId, title, message, type }
    });
  } catch (err) {
    console.error('Failed to create notification:', err);
  }
}

export const sendInvitation = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { projectId } = req.params;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const parseResult = inviteSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ success: false, message: parseResult.error.errors[0].message });
    }

    const { emailOrUsername } = parseResult.data;

    // Check sender is owner of project
    const senderMembership = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } }
    });

    if (!senderMembership || senderMembership.role !== 'OWNER') {
      return res.status(403).json({ success: false, message: 'Only project owners can invite members' });
    }

    // Resolve receiver
    const receiver = await prisma.user.findFirst({
      where: {
        OR: [
          { email: emailOrUsername.toLowerCase() },
          { username: emailOrUsername.toLowerCase() }
        ]
      }
    });

    if (!receiver) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (receiver.id === userId) {
      return res.status(400).json({ success: false, message: 'You cannot invite yourself' });
    }

    // Check if already a project member
    const existingMember = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: receiver.id } }
    });

    if (existingMember) {
      return res.status(409).json({ success: false, message: 'User is already a member of this project' });
    }

    // Check if there is already a pending invitation
    const existingInvite = await prisma.invitation.findFirst({
      where: {
        projectId,
        receiverId: receiver.id,
        status: 'PENDING'
      }
    });

    if (existingInvite) {
      return res.status(409).json({ success: false, message: 'An invitation is already pending for this user' });
    }

    // Create invitation
    const invitation = await prisma.invitation.create({
      data: {
        projectId,
        senderId: userId,
        receiverId: receiver.id,
        status: 'PENDING'
      },
      include: {
        project: { select: { name: true } }
      }
    });

    // Create notification for receiver
    const senderUser = await prisma.user.findUnique({ where: { id: userId }, select: { fullName: true } });
    await createNotification(
      receiver.id,
      'New Project Invitation',
      `${senderUser?.fullName || 'Someone'} invited you to join the project: ${invitation.project.name}`,
      'INVITATION'
    );

    return res.status(200).json({
      success: true,
      message: 'Invitation sent successfully',
      invitation
    });
  } catch (error) {
    console.error('Send invitation error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const getPendingInvitations = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const invitations = await prisma.invitation.findMany({
      where: {
        receiverId: userId,
        status: 'PENDING'
      },
      include: {
        project: {
          select: { id: true, name: true, description: true, category: true }
        },
        sender: {
          select: { id: true, fullName: true, username: true, avatarUrl: true }
        }
      }
    });

    return res.status(200).json({
      success: true,
      invitations
    });
  } catch (error) {
    console.error('Get pending invitations error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const respondToInvitation = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { invitationId } = req.params;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const parseResult = responseSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ success: false, message: 'Invalid response action' });
    }

    const { action } = parseResult.data;

    // Fetch invitation
    const invitation = await prisma.invitation.findUnique({
      where: { id: invitationId },
      include: {
        project: { select: { name: true, ownerId: true } }
      }
    });

    if (!invitation || invitation.receiverId !== userId) {
      return res.status(404).json({ success: false, message: 'Invitation not found' });
    }

    if (invitation.status !== 'PENDING') {
      return res.status(400).json({ success: false, message: 'This invitation has already been resolved' });
    }

    // Update status and memberships inside transaction if accepted
    if (action === 'ACCEPTED') {
      await prisma.$transaction([
        prisma.invitation.update({
          where: { id: invitationId },
          data: { status: 'ACCEPTED' }
        }),
        prisma.projectMember.create({
          data: {
            projectId: invitation.projectId,
            userId,
            role: 'MEMBER'
          }
        }),
        prisma.activityLog.create({
          data: {
            projectId: invitation.projectId,
            userId,
            action: 'MEMBER_JOINED',
            entityType: 'USER',
            entityId: userId
          }
        })
      ]);

      const responder = await prisma.user.findUnique({ where: { id: userId }, select: { fullName: true } });
      
      // Notify sender & project owner
      await createNotification(
        invitation.senderId,
        'Invitation Accepted',
        `${responder?.fullName || 'Teammate'} accepted your invite to project ${invitation.project.name}`,
        'INVITATION'
      );
      if (invitation.project.ownerId !== invitation.senderId) {
        await createNotification(
          invitation.project.ownerId,
          'Member Joined Project',
          `${responder?.fullName || 'Teammate'} joined project ${invitation.project.name}`,
          'INVITATION'
        );
      }

      return res.status(200).json({
        success: true,
        message: 'Invitation accepted. Joined project successfully.'
      });
    } else {
      // Action is REJECTED
      await prisma.invitation.update({
        where: { id: invitationId },
        data: { status: 'REJECTED' }
      });

      const responder = await prisma.user.findUnique({ where: { id: userId }, select: { fullName: true } });
      await createNotification(
        invitation.senderId,
        'Invitation Declined',
        `${responder?.fullName || 'Teammate'} declined your invitation to join ${invitation.project.name}`,
        'INVITATION'
      );

      return res.status(200).json({
        success: true,
        message: 'Invitation declined'
      });
    }
  } catch (error) {
    console.error('Respond invitation error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
