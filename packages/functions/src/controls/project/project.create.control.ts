import { build5Db } from '@build-5/database';
import {
  COL,
  Project,
  ProjectAdmin,
  ProjectBilling,
  ProjectCreateRequest,
  SUB_COL,
  WenError,
} from '@build-5/interfaces';
import dayjs from 'dayjs';
import jwt from 'jsonwebtoken';
import { set } from 'lodash';
import { getJwtSecretKey } from '../../utils/config.utils';
import { dateToTimestamp } from '../../utils/dateTime.utils';
import { invalidArgument } from '../../utils/error.utils';
import { getTokenBySymbol } from '../../utils/token.utils';
import { getRandomEthAddress } from '../../utils/wallet.utils';
import { Context } from '../common';

export const createProjectControl = async ({ owner, params }: Context<ProjectCreateRequest>) => {
  const memberDocRef = build5Db().doc(`${COL.MEMBER}/${owner}`);
  const member = await memberDocRef.get();
  if (!member) {
    throw invalidArgument(WenError.member_does_not_exists);
  }

  const batch = build5Db().batch();

  const projectData = {
    ...params,
    uid: getRandomEthAddress(),
    createdBy: owner,
    deactivated: false,
  } as Project;

  if (projectData.config.billing === ProjectBilling.TOKEN_BASE) {
    const token = await getTokenBySymbol(projectData.config.nativeTokenSymbol!);
    if (!token) {
      throw invalidArgument(WenError.token_does_not_exist);
    }
    set(projectData, 'config.nativeTokenUid', token.uid);
  }
  const projectDocRef = build5Db().doc(`${COL.PROJECT}/${projectData.uid}`);
  batch.create(projectDocRef, projectData);

  const adminDocRef = projectDocRef.collection(SUB_COL.ADMINS).doc(owner);
  const admin: ProjectAdmin = {
    project: projectData.uid,
    projects: { [projectData.uid]: true },
    uid: owner,
    createdOn: dateToTimestamp(dayjs()),
    parentCol: COL.PROJECT,
    parentId: projectData.uid,
  };
  batch.create(adminDocRef, admin);

  const rawJwt = { uid: owner, project: projectData.uid, iat: dayjs().unix() };
  const token = jwt.sign(rawJwt, getJwtSecretKey());
  const apiKey = {
    uid: getRandomEthAddress(),
    parentCol: COL.PROJECT,
    parentId: projectData.uid,
    token,
  };
  const apiKeyDocRef = projectDocRef.collection(SUB_COL._API_KEY).doc();
  batch.create(apiKeyDocRef, apiKey);

  await batch.commit();

  return { project: await projectDocRef.get<Project>(), token };
};
