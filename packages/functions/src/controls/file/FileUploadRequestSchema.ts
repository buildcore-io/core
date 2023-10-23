import Joi from 'joi';
import { CommonJoi } from '../../services/joi/common';

export const fileUploadSchema = Joi.object({
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
