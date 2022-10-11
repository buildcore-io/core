import admin from '../admin.config';

const getFileNameFromUrl = (url: string) => {
  const name = url
    .slice(url.indexOf('appspot'), url.length)
    .replace('appspot.com/o/', '')
    .replace(/%2F/g, '/');
  return name.slice(0, name.indexOf('?'));
};

export const getMediaMetadata = async (storage: admin.storage.Storage, url: string) => {
  try {
    const bucket = storage.bucket();
    const metadata = await bucket.file(getFileNameFromUrl(url)).getMetadata();
    return metadata[0];
  } catch {
    return {};
  }
};
