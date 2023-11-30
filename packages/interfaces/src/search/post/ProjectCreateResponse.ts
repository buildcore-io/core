import { Project } from '../../models';

export interface ProjectCreateResponse {
  readonly project: Project;
  readonly token: string;
}
