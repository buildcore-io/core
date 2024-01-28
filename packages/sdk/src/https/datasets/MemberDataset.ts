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

/**
 * Member dataset
 */
export class MemberDataset<D extends Dataset> extends DatasetClass<D, Member> {
  /**
   * Update member details.
   *
   * @param req Use {@link Build5Request} with data based on {@link MemberUpdateRequest}
   * @returns
   */
  update = (req: Build5Request<MemberUpdateRequest>) =>
    this.sendRequest(WEN_FUNC.updateMember)<MemberUpdateRequest, Member>(req);
  /**
   * Generate AUTH token.
   *
   * @param req Use {@link Build5Request} with data based on {@link CustomTokenRequest}
   * @returns
   */
  generateCustomToken = (req: Build5Request<CustomTokenRequest>) =>
    this.sendRequest(WEN_FUNC.generateCustomToken)<CustomTokenRequest, string>(req);
  /**
   * Validate member address.
   *
   * @param req Use {@link Build5Request} with data based on {@link AddressValidationRequest}
   * @returns
   */
  validateAddress = (req: Build5Request<AddressValidationRequest>) =>
    this.sendRequest(WEN_FUNC.validateAddress)<AddressValidationRequest, Transaction>(req);
}
