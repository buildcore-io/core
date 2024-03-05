import { Project } from '../../models';

/**
 * Response object to creating a Project.
 */
export interface ProjectCreateResponse {
  readonly project: Project;
  readonly token: string;
}
