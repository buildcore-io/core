import dayjs from 'dayjs';
import { get } from 'lodash';
import { IDocument } from './interfaces';

export const cOn = <T>(doc: IDocument, data: T) => ({
  ...data,
  createdOn: get(data, 'createdOn') || dayjs().toDate(),
  updatedOn: get(data, 'updatedOn') || dayjs().toDate(),
});

export const uOn = <T>(data: T) => ({ ...data, updatedOn: dayjs().toDate() });
