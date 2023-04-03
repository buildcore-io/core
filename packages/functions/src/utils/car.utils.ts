import { CarReader } from '@ipld/car';
import * as dagPb from '@ipld/dag-pb';
import { Collection, KEY_NAME_TANGLE, Nft, Token } from '@soonaverse/interfaces';
import { randomUUID } from 'crypto';
import * as functions from 'firebase-functions/v2';
import fs from 'fs';
import { FsBlockStore as Blockstore } from 'ipfs-car/blockstore/fs';
import { pack } from 'ipfs-car/pack';
import { isEmpty, last } from 'lodash';
import os from 'os';
import { Filelike, getFilesFromPath, Web3Storage } from 'web3.storage';
import { propsToAttributes } from './collection-minting-utils/nft.prop.utils';
import { getWeb3Token } from './config.utils';
import { downloadFile } from './media.utils';
const MAX_BLOCK_SIZE = 1048576;

export const PLACEHOLDER_CID = 'bafybeig3zxv7cfqvfwqljktfzyyhij67pcg45eiku4dcw2fpajzu7s4xwi';

export const packCar = async (directory: string) => {
  const blockstore = new Blockstore();
  try {
    const files = await getFilesFromPath(directory);
    const { out, root } = await pack({
      input: Array.from(files as Iterable<Filelike>).map(toImportCandidate),
      blockstore,
      maxChunkSize: MAX_BLOCK_SIZE,
    });
    const car = await CarReader.fromIterable(out);
    return { car, cid: root.toString() };
  } catch (error) {
    functions.logger.error('Pack car error', error);
    throw error;
  } finally {
    await blockstore.close();
  }
};

export const downloadMediaAndPackCar = async <M>(uid: string, mediaUrl: string, metadata: M) => {
  const workdir = `${os.tmpdir()}/${randomUUID()}`;
  fs.mkdirSync(workdir);

  await downloadFile(mediaUrl, workdir, uid);

  const metadataFileName = `metadata.json`;
  fs.writeFileSync(workdir + '/' + metadataFileName, JSON.stringify(metadata));

  const { car, cid } = await packCar(workdir);
  const cidMap = getNameToCidMap(car);

  fs.rmSync(workdir, { recursive: true, force: true });

  return {
    car,
    ipfsMedia: cidMap[uid],
    ipfsMetadata: cidMap[metadataFileName],
    ipfsRoot: cid,
  };
};

export const putCar = (car: CarReader) => {
  const client = new Web3Storage({ token: getWeb3Token() });
  return client.putCar(car, { maxRetries: 0 });
};

export const getNameToCidMap = (car: CarReader) => {
  const map: { [key: string]: string } = {};
  for (const block of car._blocks) {
    if (block.cid.code === dagPb.code) {
      const decode = dagPb.decode(block.bytes);
      decode.Links?.forEach((l) => {
        if (!isEmpty(l.Name)) {
          map[l.Name!] = l.Hash.toString();
        }
      });
    }
  }
  return map;
};

const toImportCandidate = (file: Filelike) => ({
  path: last(file.name.split('/')),
  get content() {
    return file.stream();
  },
});

export const collectionToIpfsMetadata = (collection: Collection) => ({
  name: collection.name,
  description: collection.description,
  author: collection.createdBy,
  space: collection.space,
  royaltySpace: collection.royaltiesSpace,
  platform: KEY_NAME_TANGLE,
  uid: collection.uid,
});

export const nftToIpfsMetadata = (collection: Collection, nft: Nft) => {
  const props = propsToAttributes(nft.properties);
  const stats = propsToAttributes(nft.stats);
  return {
    name: nft.name,
    description: nft.description,
    author: nft.createdBy,
    space: nft.space,
    royaltySpace: collection.royaltiesSpace,
    platform: KEY_NAME_TANGLE,
    uid: nft.uid,
    attributes: [...props, ...stats],
    collectionId: collection.uid,
  };
};

export const tokenToIpfsMetadata = (token: Token) => ({
  name: token.name,
  description: token.description || '',
  space: token.space,
  platform: KEY_NAME_TANGLE,
  uid: token.uid,
});
