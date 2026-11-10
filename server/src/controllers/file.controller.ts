import { Response } from 'express';
import multer from 'multer';
import { prisma } from '../services/db.service';
import { StorageServiceFactory } from '../services/storage.service';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

// Config multer inside memory to retrieve buffers
const storage = multer.memoryStorage();
export const uploadMiddleware = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 } // Max 50 MB
}).single('file');

export const uploadFile = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { projectId } = req.params;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file payload uploaded' });
    }

    // Check membership
    const membership = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } }
    });

    if (!membership) {
      return res.status(403).json({ success: false, message: 'You are not a member of this project' });
    }

    const storageService = StorageServiceFactory.getStorageService();
    // Save to local uploads / projectId / filename
    const uploadResult = await storageService.uploadFile(req.file, projectId);

    const projectFile = await prisma.projectFile.create({
      data: {
        projectId,
        uploadedBy: userId,
        fileName: req.file.originalname,
        fileUrl: uploadResult.fileUrl,
        fileSize: BigInt(uploadResult.fileSize),
        mimeType: uploadResult.mimeType
      },
      include: {
        user: { select: { fullName: true, username: true } }
      }
    });

    // Log project activity
    await prisma.activityLog.create({
      data: {
        projectId,
        userId,
        action: 'FILE_UPLOADED',
        entityType: 'FILE',
        entityId: projectFile.id,
        metadata: JSON.stringify({ fileName: req.file.originalname })
      }
    });

    // Broadcast socket event
    const io = req.app.get('io');
    if (io) {       
io.to(projectId).emit('file-uploaded', {
  ...projectFile,
  fileSize: projectFile.fileSize?.toString() ?? null
});
    }

    // Convert BigInt to string for JSON serialization
    const responseFile = {
      ...projectFile,
      fileSize: projectFile.fileSize ? projectFile.fileSize.toString() : '0'
    };

    return res.status(201).json({
      success: true,
      file: responseFile
    });
  } catch (error) {
    console.error('Upload file error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const getProjectFiles = async (req: AuthenticatedRequest, res: Response) => {
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

    const files = await prisma.projectFile.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { fullName: true, username: true } }
      }
    });

    // Parse BigInt for JSON serialization
    const responseFiles = files.map(file => ({
      ...file,
      fileSize: file.fileSize ? file.fileSize.toString() : '0'
    }));

    return res.status(200).json({
      success: true,
      files: responseFiles
    });
  } catch (error) {
    console.error('Get files error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const deleteFile = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { projectId, fileId } = req.params;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const file = await prisma.projectFile.findUnique({ where: { id: fileId } });
    if (!file) {
      return res.status(404).json({ success: false, message: 'File not found' });
    }

    // Check membership
    const membership = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } }
    });

    if (!membership) {
      return res.status(403).json({ success: false, message: 'You are not a member of this project' });
    }

    // Only owner of project or uploader can delete file
    if (membership.role !== 'OWNER' && file.uploadedBy !== userId) {
      return res.status(403).json({ success: false, message: 'You are not authorized to delete this file' });
    }

    // Delete from storage
    const storageService = StorageServiceFactory.getStorageService();
    if (file.fileUrl) {
      await storageService.deleteFile(file.fileUrl);
    }

    // Delete from db
    await prisma.projectFile.delete({ where: { id: fileId } });

    // Log project activity
    await prisma.activityLog.create({
      data: {
        projectId,
        userId,
        action: 'FILE_DELETED',
        entityType: 'FILE',
        entityId: fileId,
        metadata: JSON.stringify({ fileName: file.fileName })
      }
    });

    // Broadcast socket event
    const io = req.app.get('io');
    if (io) {
      io.to(projectId).emit('file-deleted', { fileId });
    }

    return res.status(200).json({
      success: true,
      message: 'File deleted successfully'
    });
  } catch (error) {
    console.error('Delete file error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
