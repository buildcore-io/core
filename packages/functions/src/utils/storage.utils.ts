import axios from 'axios';

export const fileExists = async (url: string | undefined) => {
  try {
    const head = await axios({ method: 'HEAD', url: url || '', timeout: 10000 });
    return head.status === 200;
  } catch {
    return false;
  }
};

export const getContentType = async (url: string | undefined) => {
  try {
    const head = await axios({ method: 'HEAD', url: url || '', timeout: 10000 });
    return head.headers['content-type'] || 'application/octet-stream';
  } catch {
    return 'application/octet-stream';
  }
};
