import { Bucket } from '@buildcore/interfaces';

export interface IStorage {
  bucket: (name: string) => IBucket;
}

export interface IBucket {
  getName: () => Bucket;
  upload: (path: string, destination: string, metadata: Record<string, unknown>) => Promise<string>;
  download: (fileName: string, destination: string) => Promise<void>;
  exists: (fileName: string) => Promise<boolean>;
  getFilesCount: (directory: string) => Promise<number>;
  deleteDirectory: (directory: string) => Promise<void>;
}
