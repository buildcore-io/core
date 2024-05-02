/* eslint-disable @typescript-eslint/no-explicit-any */
import { format } from 'util';

const log = async (severity = 'INFO', ...data: any[]): Promise<void> => {
  const entry = {
    severity,
    message: format(...data),
  };
  console.log(JSON.stringify(removeCircular(entry)));
};

export const logger = {
  info: (...message: any[]) => log('INFO', message),
  error: (...message: any[]) => log('ERROR', message),
  warn: (...message: any[]) => log('WARNING', message),
};

const removeCircular = (obj: any, refs: any[] = []) => {
  if (typeof obj !== 'object' || !obj) {
    return obj;
  }
  if (obj.toJSON) {
    return obj.toJSON();
  }
  if (refs.includes(obj)) {
    return '[Circular]';
  } else {
    refs.push(obj);
  }
  let returnObj: any;
  if (Array.isArray(obj)) {
    returnObj = new Array(obj.length);
  } else {
    returnObj = {};
  }
  for (const k in obj) {
    if (refs.includes(obj[k])) {
      returnObj[k] = '[Circular]';
    } else {
      returnObj[k] = removeCircular(obj[k], refs);
    }
  }
  return returnObj;
};
