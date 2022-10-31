import Joi, { AnySchema } from 'joi';
import { ethAddressLength } from './../../utils/wallet.utils';
export class CommonJoi {
  public static uid(required = true): AnySchema {
    const base = Joi.string().alphanum().length(ethAddressLength).lowercase();
    return required ? base.required() : base;
  }
}
