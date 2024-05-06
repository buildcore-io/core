import { ProjectDeactivateRequest } from '@buildcore/interfaces';
import { CommonJoi, toJoiObject } from '../../services/joi/common';

export const projectDeactivateSchema = toJoiObject<ProjectDeactivateRequest>({
  project: CommonJoi.uid(),
})
  .description('Request object to deactivate a project.')
  .meta({
    className: 'ProjectDeactivateRequest',
  });
