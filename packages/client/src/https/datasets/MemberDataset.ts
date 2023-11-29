import {
  AddressValidationRequest,
  CreateMemberRequest,
  CustomTokenRequest,
  Dataset,
  Member,
  MemberUpdateRequest,
  WEN_FUNC,
} from '@build-5/interfaces';
import { DatasetClass } from './Dataset';

export class MemberDataset<D extends Dataset> extends DatasetClass<D, Member> {
  create = this.sendRequest(WEN_FUNC.createMember)<CreateMemberRequest>;

  update = this.sendRequest(WEN_FUNC.updateMember)<MemberUpdateRequest>;

  generateCustomToken = this.sendRequest(WEN_FUNC.generateCustomToken)<CustomTokenRequest>;

  validateAddress = this.sendRequest(WEN_FUNC.validateAddress)<AddressValidationRequest>;
}
