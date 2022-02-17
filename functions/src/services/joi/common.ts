import Joi, { AnySchema } from 'joi';
import { ethAddressLength } from './../../utils/wallet.utils';
export class CommonJoi {
  public static uidCheck(): AnySchema {
    return Joi.string().length(ethAddressLength).lowercase().required();
  }
}
