import {
  Build5Request,
  Dataset,
  Project,
  ProjectDeactivateRequest,
  WEN_FUNC,
} from '@build-5/interfaces';
import { DatasetClass } from './Dataset';

/**
 * Project dataset.
 */
export class ProjectDataset<D extends Dataset> extends DatasetClass<D, Project> {
  /**
   * Deactivate project.
   *
   * @param req Use {@link Build5Request} with data based on {@link ProjectDeactivateRequest}
   * @returns
   */
  deactivate = (req: Build5Request<ProjectDeactivateRequest>) =>
    this.sendRequest(WEN_FUNC.deactivateProject)<ProjectDeactivateRequest, Project>(req);
}
