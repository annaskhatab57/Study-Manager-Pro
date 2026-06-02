import { Response } from 'express';
import { z } from 'zod';
import { prisma } from '../services/db.service';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

const messageSchema = z.object({
  content: z.string().min(1, 'Message content cannot be empty')
});

export const sendMessage = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { projectId } = req.params;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const parseResult = messageSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ success: false, message: parseResult.error.errors[0].message });
    }

    const { content } = parseResult.data;

    // Check project membership
    const membership = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } }
    });

    if (!membership) {
      return res.status(403).json({ success: false, message: 'You are not a member of this project' });
    }

    // Save message
    const message = await prisma.message.create({
      data: {
        projectId,
        senderId: userId,
        content
      },
      include: {
        sender: {
          select: { id: true, fullName: true, username: true, avatarUrl: true }
        }
      }
    });

    // Broadcast message via Socket.io
    const io = req.app.get('io');
    if (io) {
      io.to(projectId).emit('message-received', message);
    }

    return res.status(201).json({
      success: true,
      message
    });
  } catch (error) {
    console.error('Send message error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const getMessages = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { projectId } = req.params;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    // Check membership
    const membership = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } }
    });

    if (!membership) {
      return res.status(403).json({ success: false, message: 'You are not a member of this project' });
    }

    const limit = parseInt(req.query.limit as string) || 50;
    const skip = parseInt(req.query.skip as string) || 0;

    const messages = await prisma.message.findMany({
      where: { projectId },
      orderBy: { createdAt: 'asc' },
      take: limit,
      skip,
      include: {
        sender: {
          select: { id: true, fullName: true, username: true, avatarUrl: true }
        }
      }
    });

    return res.status(200).json({
      success: true,
      messages
    });
  } catch (error) {
    console.error('Get messages error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
