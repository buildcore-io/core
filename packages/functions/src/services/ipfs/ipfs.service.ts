import { Collection, KEY_NAME_TANGLE, Nft, PropStats, Token } from '@soonaverse/interfaces';
import axios from 'axios';
import * as functions from 'firebase-functions';
import fs from 'fs';
import { File, NFTStorage } from 'nft.storage';
import { MatchRecord } from 'nft.storage/dist/src/lib/interface';

export interface IpfsSuccessResult {
  metadata: string;
  image: string;
}

const nftStorageConfig = {
  endpoint: new URL('https://api.nft.storage'), // the default
  token: functions.config()?.nftstorage?.token,
};

const pinataConfig = {
  key: functions.config()?.pinata?.key,
  secret: functions.config()?.pinata?.secret,
};

export class IpfsService {
  private async pinByHash<T>(hashToPin: string, metadata: MatchRecord<T, (input: unknown) => URL>) {
    const url = `https://api.pinata.cloud/pinning/pinByHash`;
    const body = {
      hashToPin: hashToPin,
      pinataMetadata: metadata,
    };
    return axios.post(url, body, {
      headers: {
        pinata_api_key: pinataConfig.key,
        pinata_secret_api_key: pinataConfig.secret,
      },
    });
  }

  private async pinJSONToIPFS<T>(metadata: MatchRecord<T, (input: unknown) => URL>) {
    const url = `https://api.pinata.cloud/pinning/pinJSONToIPFS`;
    const body = {
      pinataMetadata: metadata,
      pinataContent: metadata,
    };
    return axios.post(url, body, {
      headers: {
        pinata_api_key: pinataConfig.key,
        pinata_secret_api_key: pinataConfig.secret,
      },
    });
  }

  private async nftUpload(fileUrl: string, nft: Nft, collection: Collection) {
    const storage = new NFTStorage({
      endpoint: nftStorageConfig.endpoint,
      token: nftStorageConfig.token,
    });

    // Let's get the file from URL and detect the type.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const file: any = await fetch(fileUrl);
    const filename: string = nft.uid + Math.random() * 1000;
    const fileStream = fs.createWriteStream('/tmp/' + filename);
    await new Promise((resolve, reject) => {
      file.body.pipe(fileStream);
      file.body.on('error', reject);
      fileStream.on('finish', resolve);
    });
    const finalMetadata = await storage.store({
      name: nft.name,
      description: nft.description,
      author: nft.createdBy,
      space: nft.space,
      royaltySpace: collection.royaltiesSpace,
      image: new File([await fs.promises.readFile('/tmp/' + filename)], nft.name, {
        type: file.headers.get('content-type'),
      }),
      platform: KEY_NAME_TANGLE,
      uid: nft.uid,
      properties: this.formatPropsStats(nft.properties),
      stats: this.formatPropsStats(nft.stats),
      collectionId: nft.collection,
    });

    await fs.promises.rm('/tmp/' + filename);
    // Details
    return {
      metadata: finalMetadata.embed(),
      image: finalMetadata.embed().image.pathname,
    };
  }

  private async collectionUpload(fileUrl: string, collection: Collection) {
    const storage = new NFTStorage({
      endpoint: nftStorageConfig.endpoint,
      token: nftStorageConfig.token,
    });

    // Let's get the file from URL and detect the type.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const file: any = await fetch(fileUrl);
    const filename: string = collection.uid + Math.random() * 1000;
    const fileStream = fs.createWriteStream('/tmp/' + filename);
    await new Promise((resolve, reject) => {
      file.body.pipe(fileStream);
      file.body.on('error', reject);
      fileStream.on('finish', resolve);
    });
    const finalMetadata = await storage.store({
      name: collection.name,
      description: collection.description,
      author: collection.createdBy,
      space: collection.space,
      royaltySpace: collection.royaltiesSpace,
      image: new File([await fs.promises.readFile('/tmp/' + filename)], collection.name, {
        type: file.headers.get('content-type'),
      }),
      platform: KEY_NAME_TANGLE,
      uid: collection.uid,
    });

    await fs.promises.rm('/tmp/' + filename);
    // Details
    return {
      metadata: finalMetadata.embed(),
      image: finalMetadata.embed().image.pathname,
    };
  }

  private async tokenUpload(fileUrl: string, token: Token) {
    const storage = new NFTStorage({
      endpoint: nftStorageConfig.endpoint,
      token: nftStorageConfig.token,
    });

    // Let's get the file from URL and detect the type.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const file: any = await fetch(fileUrl);
    const filename: string = token.uid + Math.random() * 1000;
    const fileStream = fs.createWriteStream('/tmp/' + filename);
    await new Promise((resolve, reject) => {
      file.body.pipe(fileStream);
      file.body.on('error', reject);
      fileStream.on('finish', resolve);
    });
    const finalMetadata = await storage.store({
      name: token.name,
      description: token.description || '',
      space: token.space,
      image: new File([await fs.promises.readFile('/tmp/' + filename)], token.name, {
        type: file.headers.get('content-type'),
      }),
      platform: KEY_NAME_TANGLE,
      uid: token.uid,
    });

    await fs.promises.rm('/tmp/' + filename);
    // Details
    return {
      metadata: finalMetadata.embed(),
      image: finalMetadata.embed().image.pathname,
    };
  }

  private formatPropsStats(obj: PropStats) {
    const out = {} as { [key: string]: string };
    for (const [key, o] of Object.entries(obj || {})) {
      out[key] = o.value;
    }

    return out;
  }

  public async fileUploadNft(
    fileUrl: string,
    nft: Nft,
    collection: Collection,
  ): Promise<IpfsSuccessResult | undefined> {
    console.log('Uploading to storage: ' + fileUrl);
    const out = await this.nftUpload(fileUrl, nft, collection);
    if (out) {
      try {
        console.log('Pinning to Pinata...');
        const metadata = await this.pinJSONToIPFS(out.metadata);
        const cid = out.image.split('/')[2];
        await this.pinByHash(cid, out.metadata);
        console.log('Pinning finished.');
        return {
          metadata: metadata.data.IpfsHash,
          image: cid,
        };
      } catch (e) {
        console.log('Failed to pin ' + fileUrl, e);
      }
    }

    return undefined;
  }

  public async fileUploadCollection(
    fileUrl: string,
    collection: Collection,
  ): Promise<IpfsSuccessResult | undefined> {
    console.log('Uploading to storage: ' + fileUrl);
    const out = await this.collectionUpload(fileUrl, collection);
    if (out) {
      try {
        console.log('Pinning to Pinata...');
        const metadata = await this.pinJSONToIPFS(out.metadata);
        const cid = out.image.split('/')[2];
        await this.pinByHash(cid, out.metadata);
        console.log('Pinning finished.');
        return {
          metadata: metadata.data.IpfsHash,
          image: cid,
        };
      } catch (e) {
        console.log('Failed to pin ' + fileUrl, e);
      }
    }

    return undefined;
  }

  public async fileUploadToken(
    fileUrl: string,
    token: Token,
  ): Promise<IpfsSuccessResult | undefined> {
    console.log('Uploading to storage: ' + fileUrl);
    const out = await this.tokenUpload(fileUrl, token);
    if (out) {
      try {
        console.log('Pinning to Pinata...');
        const metadata = await this.pinJSONToIPFS(out.metadata);
        const cid = out.image.split('/')[2];
        await this.pinByHash(cid, out.metadata);
        console.log('Pinning finished.');
        return {
          metadata: metadata.data.IpfsHash,
          image: cid,
        };
      } catch (e) {
        console.log('Failed to pin ' + fileUrl, e);
      }
    }

    return undefined;
  }
}
