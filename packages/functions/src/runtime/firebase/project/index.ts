import { WEN_FUNC } from '@build-5/interfaces';
import { createProjectControl } from '../../../controls/project/project.create.control';
import { deactivateProjectControl } from '../../../controls/project/project.deactivate.control';
import { toJoiObject } from '../../../services/joi/common';
import { onRequest } from '../common';
import { projectCreateSchema } from './ProjectCreateSchema';

export const createProject = onRequest(WEN_FUNC.createProject)(
  projectCreateSchema,
  createProjectControl,
  undefined,
  false,
);

export const deactivateProject = onRequest(WEN_FUNC.deactivateProject)(
  toJoiObject({}),
  deactivateProjectControl,
);
