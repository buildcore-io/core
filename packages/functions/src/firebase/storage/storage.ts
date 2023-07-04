import { Bucket } from '@build-5/interfaces';
import { Bucket as FBucket } from '@google-cloud/storage';
import { Storage } from 'firebase-admin/storage';
import { FirebaseApp } from '../app/app';
import { IBucket, IStorage } from './interfaces';

export class FirebaseStorage implements IStorage {
  private readonly storage: Storage;

  constructor(private readonly app: FirebaseApp) {
    this.storage = this.app.getInstance().storage();
  }

  public bucket = (name: string) => new FirebaseBucket(this.storage, name as Bucket);
}

export class FirebaseBucket implements IBucket {
  private readonly bucket: FBucket;

  constructor(private readonly storage: Storage, private readonly name: Bucket) {
    this.bucket = this.storage.bucket(this.name);
  }

  public getName = () => this.name;

  public upload = async (path: string, destination: string, metadata: Record<string, unknown>) => {
    const response = await this.bucket.upload(path, { destination, metadata });
    return response[1].mediaLink;
  };

  public download = async (fileName: string, destination: string) => {
    await this.bucket.file(fileName).download({ destination });
  };

  public exists = async (fileName: string) => (await this.bucket.file(fileName).exists())[0];

  public getFilesCount = async (directory: string) => {
    const files = await this.bucket.getFiles({ prefix: directory });
    return files[0].length;
  };
}
