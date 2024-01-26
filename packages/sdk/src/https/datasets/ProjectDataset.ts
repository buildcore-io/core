import {
  Build5Request,
  Dataset,
  Project,
  ProjectDeactivateRequest,
  WEN_FUNC,
} from '@build-5/interfaces';
import { DatasetClass } from './Dataset';

export class ProjectDataset<D extends Dataset> extends DatasetClass<D, Project> {
  deactivate = (req: Build5Request<ProjectDeactivateRequest>) =>
    this.sendRequest(WEN_FUNC.deactivateProject)<ProjectDeactivateRequest, Project>(req);
}
