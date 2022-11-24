import admin from '../admin.config';

const getBucket = (storageUrl: string) => {
  const start = storageUrl.indexOf('b/');
  const end = storageUrl.indexOf('/o');
  return storageUrl.slice(start + 2, end);
};

const getFileName = (storageUrl: string) => {
  const start = storageUrl.indexOf('o/');
  const end = storageUrl.indexOf('?alt');
  return storageUrl.slice(start + 2, end).replace(/%2F/g, '/');
};

export const fileExistsInStorage = async (url: string) => {
  const bucket = getBucket(url);
  const fileName = getFileName(url);
  try {
    return (await admin.storage().bucket(bucket).file(fileName).exists())[0];
  } catch {
    return false;
  }
};

export const getMediaMetadata = async (url: string) => {
  try {
    const bucket = admin.storage().bucket(getBucket(url));
    const metadata = await bucket.file(getFileName(url)).getMetadata();
    return metadata[0];
  } catch {
    return {};
  }
};
