import {
  AddressValidationRequest,
  CustomTokenRequest,
  Dataset,
  Member,
  MemberUpdateRequest,
  Transaction,
  WEN_FUNC,
} from '@build-5/interfaces';
import { DatasetClass } from './Dataset';

export class MemberDataset<D extends Dataset> extends DatasetClass<D, Member> {
  update = this.sendRequest(WEN_FUNC.updateMember)<MemberUpdateRequest, Member>;

  generateCustomToken = this.sendRequest(WEN_FUNC.generateCustomToken)<CustomTokenRequest, string>;

  validateAddress = this.sendRequest(WEN_FUNC.validateAddress)<
    AddressValidationRequest,
    Transaction
  >;
}
