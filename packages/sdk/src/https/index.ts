import {
  BuildcoreRequest,
  CreateMemberRequest,
  Member,
  ProjectCreateRequest,
  ProjectCreateResponse,
  WEN_FUNC,
} from '@buildcore/interfaces';
import axios from 'axios';
import { ProjectWrapper } from './https';

export const https = (origin: string = Buildcore.PROD) => new HttpsWrapper(origin as Buildcore);

class HttpsWrapper {
  constructor(private readonly origin: Buildcore) {}

  private sendRequest =
    (name: WEN_FUNC) =>
    async <Req, Res>(request: BuildcoreRequest<Req>) => {
      try {
        const isLocal = !Object.values(Buildcore).includes(this.origin);
        const url = this.origin + `/${isLocal ? 'https-' : ''}` + name;
        return (await axios.post(url, request)).data as Res;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (error: any) {
        throw error.response.data;
      }
    };

  project = (apiKey: string) => new ProjectWrapper(this.origin, apiKey);

  createMember = (req: BuildcoreRequest<CreateMemberRequest>) =>
    this.sendRequest(WEN_FUNC.createMember)<CreateMemberRequest, Member>(req);

  createProject = (req: BuildcoreRequest<ProjectCreateRequest>) =>
    this.sendRequest(WEN_FUNC.createProject)<ProjectCreateRequest, ProjectCreateResponse>(req);
}

/**
 * Build.5 API endpoints.
 */
export enum Buildcore {
  PROD = 'https://api.buildcore.io',
  TEST = 'https://api-test.buildcore.io',
}

/**
 * Soonaverse API keys.
 */
export const SoonaverseApiKey: { [key: string]: string } = {
  [Buildcore.PROD]:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiIweDU1MWZkMmM3YzdiZjM1NmJhYzE5NDU4N2RhYjJmY2Q0NjQyMDA1NGIiLCJwcm9qZWN0IjoiMHg0NjIyM2VkZDQxNTc2MzVkZmM2Mzk5MTU1NjA5ZjMwMWRlY2JmZDg4IiwiaWF0IjoxNzAwMDAyODkwfQ.IYZvBRuCiN0uYORKnVJ0SzT_1H_2o5xyDBG20VmnTQ0',
  [Buildcore.TEST]:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiIweDU1MWZkMmM3YzdiZjM1NmJhYzE5NDU4N2RhYjJmY2Q0NjQyMDA1NGIiLCJwcm9qZWN0IjoiMHg0NjIyM2VkZDQxNTc2MzVkZmM2Mzk5MTU1NjA5ZjMwMWRlY2JmZDg4IiwiaWF0IjoxNjk1ODUyNTk2fQ.WT9L4H9eDdFfJZMrfxTKhEq4PojNWSGNv_CbmlG9sJg',
};
