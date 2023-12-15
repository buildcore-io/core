import {
  Build5Request,
  CreateMemberRequest,
  Member,
  ProjectCreateRequest,
  ProjectCreateResponse,
  WEN_FUNC,
} from '@build-5/interfaces';
import axios from 'axios';
import { ProjectWrapper } from './https';

export const https = (origin: string = Build5.PROD) => new HttpsWrapper(origin as Build5);

class HttpsWrapper {
  constructor(private readonly origin: Build5) {}

  private sendRequest =
    (name: WEN_FUNC) =>
    async <Req, Res>(request: Build5Request<Req>) => {
      try {
        const isLocal = !Object.values(Build5).includes(this.origin);
        const url = this.origin + `/${isLocal ? 'https-' : ''}` + name;
        return (await axios.post(url, request)).data as Res;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (error: any) {
        throw error.response.data;
      }
    };

  project = (apiKey: string) => new ProjectWrapper(this.origin, apiKey);

  createMember = this.sendRequest(WEN_FUNC.createMember)<CreateMemberRequest, Member>;

  createProject = this.sendRequest(WEN_FUNC.createProject)<
    ProjectCreateRequest,
    ProjectCreateResponse
  >;
}

export enum Build5 {
  PROD = 'https://api.build5.com',
  TEST = 'https://api-test.build5.com',
}

export const API_KEY: { [key: string]: string } = {
  [Build5.PROD]:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiIweDU1MWZkMmM3YzdiZjM1NmJhYzE5NDU4N2RhYjJmY2Q0NjQyMDA1NGIiLCJwcm9qZWN0IjoiMHg0NjIyM2VkZDQxNTc2MzVkZmM2Mzk5MTU1NjA5ZjMwMWRlY2JmZDg4IiwiaWF0IjoxNzAwMDAyODkwfQ.IYZvBRuCiN0uYORKnVJ0SzT_1H_2o5xyDBG20VmnTQ0',
  [Build5.TEST]:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiIweDU1MWZkMmM3YzdiZjM1NmJhYzE5NDU4N2RhYjJmY2Q0NjQyMDA1NGIiLCJwcm9qZWN0IjoiMHg0NjIyM2VkZDQxNTc2MzVkZmM2Mzk5MTU1NjA5ZjMwMWRlY2JmZDg4IiwiaWF0IjoxNjk1ODUyNTk2fQ.WT9L4H9eDdFfJZMrfxTKhEq4PojNWSGNv_CbmlG9sJg',
};
