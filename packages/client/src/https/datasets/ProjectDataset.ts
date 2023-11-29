import {
  Dataset,
  Project,
  ProjectCreateRequest,
  ProjectDeactivateRequest,
  WEN_FUNC,
} from '@build-5/interfaces';
import { DatasetClass } from './Dataset';

export class ProjectDataset<D extends Dataset> extends DatasetClass<D, Project> {
  create = this.sendRequest(WEN_FUNC.createProject)<ProjectCreateRequest>;

  deactivate = this.sendRequest(WEN_FUNC.deactivateProject)<ProjectDeactivateRequest>;
}
