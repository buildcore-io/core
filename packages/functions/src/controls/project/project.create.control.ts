import { IBatch, build5Db } from '@build-5/database';
import {
  COL,
  Project,
  ProjectAdmin,
  ProjectBilling,
  ProjectCreateRequest,
  ProjectCreateResponse,
  ProjectOtr,
  SUB_COL,
  Transaction,
  TransactionPayloadType,
  TransactionType,
  TransactionValidationType,
  WenError,
} from '@build-5/interfaces';
import dayjs from 'dayjs';
import jwt from 'jsonwebtoken';
import { set } from 'lodash';
import { WalletService } from '../../services/wallet/wallet.service';
import { generateRandomAmount } from '../../utils/common.utils';
import { getJwtSecretKey } from '../../utils/config.utils';
import { dateToTimestamp } from '../../utils/dateTime.utils';
import { invalidArgument } from '../../utils/error.utils';
import { getTokenBySymbol } from '../../utils/token.utils';
import { getRandomEthAddress } from '../../utils/wallet.utils';
import { AVAILABLE_NETWORKS, Context } from '../common';

export const createProjectControl = async ({
  owner,
  params,
}: Context<ProjectCreateRequest>): Promise<ProjectCreateResponse> => {
  const memberDocRef = build5Db().doc(COL.MEMBER, owner);
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

  if (projectData.config.billing === ProjectBilling.TOKEN_BASED) {
    const token = await getTokenBySymbol(projectData.config.nativeTokenSymbol!);
    if (!token) {
      throw invalidArgument(WenError.token_does_not_exist);
    }
    set(projectData, 'config.nativeTokenUid', token.uid);
  }
  const projectDocRef = build5Db().doc(COL.PROJECT, projectData.uid);

  const otr = await createOtrs(batch, projectData.uid);
  set(projectData, 'otr', otr);

  batch.create(projectDocRef, projectData);

  const adminDocRef = build5Db().doc(COL.PROJECT, projectData.uid, SUB_COL.ADMINS, owner);
  const admin: ProjectAdmin = {
    project: projectData.uid,
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
    createdOn: dateToTimestamp(dayjs()),
  };
  const apiKeyDocRef = build5Db().doc(COL.PROJECT, projectData.uid, SUB_COL._API_KEY, apiKey.uid);
  batch.create(apiKeyDocRef, apiKey);

  await batch.commit();

  return { project: (await projectDocRef.get())!, token };
};

const createOtrs = async (batch: IBatch, project: string) => {
  const promise = AVAILABLE_NETWORKS.map(async (network) => {
    const wallet = await WalletService.newWallet(network);
    const targetAddress = await wallet.getNewIotaAddressDetails();
    const order: Transaction = {
      project,
      type: TransactionType.ORDER,
      uid: getRandomEthAddress(),
      network: network,
      payload: {
        type: TransactionPayloadType.TANGLE_REQUEST,
        amount: generateRandomAmount(),
        targetAddress: targetAddress.bech32,
        expiresOn: dateToTimestamp(dayjs().add(100, 'y')),
        validationType: TransactionValidationType.ADDRESS,
        reconciled: false,
        void: false,
        chainReference: null,
      },
      linkedTransactions: [],
    };
    return order;
  });
  const otrs = await Promise.all(promise);

  for (const otr of otrs) {
    const docRef = build5Db().doc(COL.TRANSACTION, otr.uid);
    batch.create(docRef, otr);
  }

  return otrs.reduce(
    (acc, act) => ({
      ...acc,
      [act.uid]: { network: act.network, targetAddress: act.payload.targetAddress! } as ProjectOtr,
    }),
    {} as { [key: string]: ProjectOtr },
  );
};
