import fs from 'fs';
import path from 'path';

export interface UploadResult {
  fileUrl: string;
  fileSize: number;
  mimeType: string;
}

export interface StorageService {
  uploadFile(file: Express.Multer.File, folderPath: string): Promise<UploadResult>;
  deleteFile(fileUrl: string): Promise<boolean>;
  getDownloadUrl(fileUrl: string): string;
}

export class LocalStorageService implements StorageService {
  private uploadDir: string;

  constructor() {
    this.uploadDir = process.env.UPLOAD_DIR || './uploads';
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  async uploadFile(file: Express.Multer.File, folderPath: string): Promise<UploadResult> {
    const targetFolder = path.join(this.uploadDir, folderPath);
    if (!fs.existsSync(targetFolder)) {
      fs.mkdirSync(targetFolder, { recursive: true });
    }

    const fileExtension = path.extname(file.originalname);
    const uniqueFileName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${fileExtension}`;
    const targetFilePath = path.join(targetFolder, uniqueFileName);

    await fs.promises.writeFile(targetFilePath, file.buffer);

    const fileUrl = `/uploads/${folderPath}/${uniqueFileName}`.replace(/\\/g, '/');

    return {
      fileUrl,
      fileSize: file.size,
      mimeType: file.mimetype,
    };
  }

  async deleteFile(fileUrl: string): Promise<boolean> {
    if (!fileUrl.startsWith('/uploads/')) {
      return false;
    }
    const relativePath = fileUrl.replace('/uploads/', '');
    const fullPath = path.join(this.uploadDir, relativePath);

    if (fs.existsSync(fullPath)) {
      await fs.promises.unlink(fullPath);
      return true;
    }
    return false;
  }

  getDownloadUrl(fileUrl: string): string {
    return fileUrl;
  }
}

export class StorageServiceFactory {
  static getStorageService(): StorageService {
    const provider = process.env.STORAGE_PROVIDER || 'local';
    if (provider === 'local') {
      return new LocalStorageService();
    }
    throw new Error(`Unsupported storage provider: ${provider}`);
  }
}
