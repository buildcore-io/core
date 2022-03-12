import axios from 'axios';
import * as functions from 'firebase-functions';
import fs from 'fs';
import { File, NFTStorage } from 'nft.storage';
import { Collection } from '../../../interfaces/models';
import { Nft, PropStats } from '../../../interfaces/models/nft';

export interface IpfsSuccessResult {
  metadata: string;
  image: string;
}

const nftStorageConfig: any = {
  endpoint: 'https://api.nft.storage', // the default
  token: functions.config()?.nftstorage.token
}

const pinataConfig: any = {
  key: functions.config()?.pinata.key,
  secret: functions.config()?.pinata.secret
}

export class IpfsService {
  private async pinByHash(hashToPin: any, metadata: any): Promise<any> {
    const url = `https://api.pinata.cloud/pinning/pinByHash`;
    const body = {
        hashToPin: hashToPin,
        pinataMetadata: metadata
    };
    return axios.post(url, body, {
        headers: {
            pinata_api_key: pinataConfig.key,
            pinata_secret_api_key: pinataConfig.secret
        }
    });
  };

  private async pinJSONToIPFS(metadata: any): Promise<any> {
    const url = `https://api.pinata.cloud/pinning/pinJSONToIPFS`;
    const body = {
        pinataMetadata: metadata,
        pinataContent: metadata
    };
    return axios.post(url, body, {
        headers: {
            pinata_api_key: pinataConfig.key,
            pinata_secret_api_key: pinataConfig.secret
        }
    });
  };

  private async nftUpload(fileUrl: string, nft: Nft, collection: Collection) {
    const storage = new NFTStorage({ endpoint: nftStorageConfig.endpoint, token: nftStorageConfig.token });

    // Let's get the file from URL and detect the type.
    const file: any = await fetch(fileUrl);
    const filename: string = nft.uid + (Math.random() * 1000);
    const fileStream = fs.createWriteStream('/tmp/' + filename);
    await new Promise((resolve, reject) => {
      file.body.pipe(fileStream);
      file.body.on("error", reject);
      fileStream.on("finish", resolve);
    });
    const finalMetadata: any = await storage.store({
      name: nft.name,
      description: nft.description,
      author: nft.createdBy,
      space: nft.space,
      royaltySpace: collection.royaltiesSpace,
      image: new File([await fs.promises.readFile('/tmp/' + filename)], nft.name, {
        type: file.headers.get('content-type'),
      }),
      platform: 'Soonaverse',
      uid: nft.uid,
      properties: this.formatPropsStats(nft.properties),
      stats: this.formatPropsStats(nft.stats),
    });

    await fs.promises.rm('/tmp/' + filename);
    // Details
    return {
      metadata: finalMetadata.embed(),
      image: finalMetadata.embed().image.pathname
    };
  }

  private formatPropsStats(obj: PropStats) {
    const out: any = {};
    for (const [key, o] of Object.entries(obj || {})) {
      out[key] = o.value;
    }

    return out;
  }

  public async fileUpload(fileUrl: string, nft: Nft, collection: Collection): Promise<IpfsSuccessResult|undefined> {
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
          image: cid
        };
      } catch(e) {
        console.log('Failed to pin ' + fileUrl, e);
      }
    }

    return undefined;
  }
}
