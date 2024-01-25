import {
  AddressValidationRequest,
  Build5Request,
  CustomTokenRequest,
  Dataset,
  Member,
  MemberUpdateRequest,
  Transaction,
  WEN_FUNC,
} from '@build-5/interfaces';
import { DatasetClass } from './Dataset';

export class MemberDataset<D extends Dataset> extends DatasetClass<D, Member> {
  update = (req: Build5Request<MemberUpdateRequest>) =>
    this.sendRequest(WEN_FUNC.updateMember)<MemberUpdateRequest, Member>(req);

  generateCustomToken = (req: Build5Request<CustomTokenRequest>) =>
    this.sendRequest(WEN_FUNC.generateCustomToken)<CustomTokenRequest, string>(req);

  validateAddress = (req: Build5Request<AddressValidationRequest>) =>
    this.sendRequest(WEN_FUNC.validateAddress)<AddressValidationRequest, Transaction>(req);
}
