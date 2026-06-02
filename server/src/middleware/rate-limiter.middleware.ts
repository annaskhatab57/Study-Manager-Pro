import { Request, Response, NextFunction } from 'express';

const ipRequestCounts = new Map<string, { count: number; resetTime: number }>();

export const rateLimiter = (req: Request, res: Response, next: NextFunction) => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const WINDOW_MS = 60 * 1000; // 1 minute window
  const MAX_REQUESTS = 100; // max 100 requests per minute

  const ipData = ipRequestCounts.get(ip);

  if (!ipData) {
    ipRequestCounts.set(ip, { count: 1, resetTime: now + WINDOW_MS });
    return next();
  }

  if (now > ipData.resetTime) {
    ipRequestCounts.set(ip, { count: 1, resetTime: now + WINDOW_MS });
    return next();
  }

  ipData.count++;
  if (ipData.count > MAX_REQUESTS) {
    return res.status(429).json({
      success: false,
      message: 'Too many requests from this IP, please try again after 1 minute.'
    });
  }

  next();
};
