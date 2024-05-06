import { FileUploadRequest } from '@buildcore/interfaces';
import Joi from 'joi';
import { CommonJoi, toJoiObject } from '../../services/joi/common';

export const fileUploadSchema = toJoiObject<FileUploadRequest>({
  member: CommonJoi.uid().description('Buildcore id of the member.'),
  uid: Joi.string().alphanum().max(100).required().description('Id for the file.'),
})
  .description('Request object to upload a file.')
  .meta({
    className: 'FileUploadRequest',
  });
