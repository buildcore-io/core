import { FileUploadRequest } from '@build-5/interfaces';
import Joi from 'joi';
import { CommonJoi, toJoiObject } from '../../../services/joi/common';

export const fileUploadSchema = toJoiObject<FileUploadRequest>({
  member: CommonJoi.uid().description('Build5 id of the member.'),
  uid: Joi.string().alphanum().max(100).required().description('Id for the file.'),
  mimeType: Joi.string()
    .regex(/^(image|video)/)
    .required()
    .description('Mime type of the file'),
})
  .description('Request object to upload a file.')
  .meta({
    className: 'FileUploadRequest',
  });
