import {
  AddressValidationRequest,
  BuildcoreRequest,
  CustomTokenRequest,
  Dataset,
  Member,
  MemberUpdateRequest,
  Transaction,
  WEN_FUNC,
} from '@buildcore/interfaces';
import { DatasetClass } from './Dataset';

/**
 * Member dataset
 */
export class MemberDataset<D extends Dataset> extends DatasetClass<D, Member> {
  /**
   * Update member details.
   *
   * @param req Use {@link BuildcoreRequest} with data based on {@link MemberUpdateRequest}
   * @returns
   */
  update = (req: BuildcoreRequest<MemberUpdateRequest>) =>
    this.sendRequest(WEN_FUNC.updateMember)<MemberUpdateRequest, Member>(req);
  /**
   * Generate AUTH token.
   *
   * @param req Use {@link BuildcoreRequest} with data based on {@link CustomTokenRequest}
   * @returns
   */
  generateCustomToken = (req: BuildcoreRequest<CustomTokenRequest>) =>
    this.sendRequest(WEN_FUNC.generateCustomToken)<CustomTokenRequest, string>(req);
  /**
   * Validate member address.
   *
   * @param req Use {@link BuildcoreRequest} with data based on {@link AddressValidationRequest}
   * @returns
   */
  validateAddress = (req: BuildcoreRequest<AddressValidationRequest>) =>
    this.sendRequest(WEN_FUNC.validateAddress)<AddressValidationRequest, Transaction>(req);
}
