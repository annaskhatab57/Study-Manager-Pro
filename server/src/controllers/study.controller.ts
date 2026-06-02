import { Response } from 'express';
import { z } from 'zod';
import { prisma } from '../services/db.service';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

const sessionSchema = z.object({
  durationMinutes: z.number().int().positive('Duration must be positive'),
  sessionType: z.enum(['FOCUS', 'SHORT_BREAK', 'LONG_BREAK']),
  startedAt: z.string().optional().transform(val => val ? new Date(val) : undefined),
  endedAt: z.string().optional().transform(val => val ? new Date(val) : undefined)
});

export const logStudySession = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const parseResult = sessionSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: parseResult.error.flatten().fieldErrors
      });
    }

    const { durationMinutes, sessionType, startedAt, endedAt } = parseResult.data;

    const session = await prisma.studySession.create({
      data: {
        userId,
        durationMinutes,
        sessionType,
        startedAt,
        endedAt
      }
    });

    return res.status(201).json({
      success: true,
      session
    });
  } catch (error) {
    console.error('Log study session error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const getStudyStats = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    // Calculate sum of FOCUS minutes
    const focusSum = await prisma.studySession.aggregate({
      where: {
        userId,
        sessionType: 'FOCUS'
      },
      _sum: {
        durationMinutes: true
      }
    });

    const totalMinutes = focusSum._sum.durationMinutes || 0;
    const focusHours = parseFloat((totalMinutes / 60).toFixed(1));

    return res.status(200).json({
      success: true,
      totalMinutes,
      focusHours
    });
  } catch (error) {
    console.error('Get study stats error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
