import { Bucket } from '@buildcore/interfaces';
import { Bucket as FBucket, Storage } from '@google-cloud/storage';
import { IBucket, IStorage } from './interfaces';

export class FirebaseStorage implements IStorage {
  private readonly storage = new Storage();

  constructor() {}

  public bucket = (name: string) => new FirebaseBucket(this.storage, name as Bucket);
}

export class FirebaseBucket implements IBucket {
  private readonly bucket: FBucket;

  constructor(
    private readonly storage: Storage,
    private readonly name: Bucket,
  ) {
    this.bucket = this.storage.bucket(this.name);
  }

  public getName = () => this.name;

  public upload = async (path: string, destination: string, metadata: Record<string, unknown>) => {
    const response = await this.bucket.upload(path, { destination, metadata });
    const responseMetadata = response[0].metadata;
    return responseMetadata.mediaLink!.replace(`generation=${responseMetadata.generation}&`, '');
  };

  public download = async (fileName: string, destination: string) => {
    await this.bucket.file(fileName).download({ destination });
  };

  public exists = async (fileName: string) => (await this.bucket.file(fileName).exists())[0];

  public getFilesCount = async (directory: string) => {
    const files = await this.bucket.getFiles({ prefix: directory });
    return files[0].length;
  };

  public deleteDirectory = async (directory: string) => {
    const files = await this.bucket.getFiles({ prefix: directory });
    const promise = files[0].map((f) => f.delete());
    await Promise.all(promise);
  };
}
