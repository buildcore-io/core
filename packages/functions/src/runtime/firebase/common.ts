import Joi from 'joi';
import { CommonJoi } from '../../services/joi/common';

export const uidSchema = Joi.object({ uid: CommonJoi.uid });
