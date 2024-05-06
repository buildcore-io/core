import {
  BuildcoreRequest,
  Dataset,
  Project,
  ProjectDeactivateRequest,
  WEN_FUNC,
} from '@buildcore/interfaces';
import { DatasetClass } from './Dataset';

/**
 * Project dataset.
 */
export class ProjectDataset<D extends Dataset> extends DatasetClass<D, Project> {
  /**
   * Deactivate project.
   *
   * @param req Use {@link BuildcoreRequest} with data based on {@link ProjectDeactivateRequest}
   * @returns
   */
  deactivate = (req: BuildcoreRequest<ProjectDeactivateRequest>) =>
    this.sendRequest(WEN_FUNC.deactivateProject)<ProjectDeactivateRequest, Project>(req);
}
