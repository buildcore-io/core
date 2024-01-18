import { Collection, KEY_NAME_TANGLE, Nft, Token } from '@build-5/interfaces';
import { CarReader } from '@ipld/car';
import * as dagPb from '@ipld/dag-pb';
import { randomUUID } from 'crypto';
import { FileLike, filesFromPaths } from 'files-from-path';
import fs from 'fs';
import { FsBlockStore as Blockstore } from 'ipfs-car/blockstore/fs';
import { pack } from 'ipfs-car/pack';
import { isEmpty, last } from 'lodash';
import { NFTStorage } from 'nft.storage';
import os from 'os';
import { propsToAttributes } from './collection-minting-utils/nft.prop.utils';
import { getNftStorageToken } from './config.utils';
import { downloadFile } from './media.utils';
const MAX_BLOCK_SIZE = 1048576;

export const PLACEHOLDER_CID = 'bafybeig3zxv7cfqvfwqljktfzyyhij67pcg45eiku4dcw2fpajzu7s4xwi';

export const packCar = async (directory: string) => {
  const blockstore = new Blockstore();
  try {
    const files = await filesFromPaths(directory);
    const { out, root } = await pack({
      input: files.map(toImportCandidate),
      blockstore,
      maxChunkSize: MAX_BLOCK_SIZE,
    });
    const car = await CarReader.fromIterable(out);
    return { car, cid: root.toString() };
  } catch (error) {
    console.error('Pack car error', error);
    throw error;
  } finally {
    await blockstore.close();
  }
};

export const downloadMediaAndPackCar = async <M>(uid: string, mediaUrl: string, metadata?: M) => {
  const workdir = `${os.tmpdir()}/${randomUUID()}`;
  fs.mkdirSync(workdir);

  const { size: bytes, hash, extension } = await downloadFile(mediaUrl, workdir, uid);

  const metadataFileName = `metadata.json`;
  if (!isEmpty(metadata)) {
    fs.writeFileSync(workdir + '/' + metadataFileName, JSON.stringify(metadata));
  }

  const { car, cid } = await packCar(workdir);
  const cidMap = getNameToCidMap(car);
  fs.rmSync(workdir, { recursive: true, force: true });
  return {
    car,
    ipfsMedia: cidMap[uid],
    ipfsMetadata: cidMap[metadataFileName] || '',
    ipfsRoot: cid,
    bytes,
    hash,
    extension,
  };
};

export const putCar = (car: CarReader) => {
  const client = new NFTStorage({ token: getNftStorageToken() });
  return client.storeCar(car, { maxRetries: 0 });
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

const toImportCandidate = (file: FileLike) => ({
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
  royaltySpace: collection.royaltiesSpace || '',
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
    royaltySpace: collection.royaltiesSpace || '',
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
  symbol: token.symbol.toUpperCase(),
});
