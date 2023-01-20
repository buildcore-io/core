import { COL, Proposal, WenError, WenRequest, WEN_FUNC } from '@soonaverse/interfaces';
import * as functions from 'firebase-functions';
import Joi from 'joi';
import admin from '../../admin.config';
import { scale } from '../../scale.settings';
import { CommonJoi } from '../../services/joi/common';
import { uOn } from '../../utils/dateTime.utils';
import { throwInvalidArgument } from '../../utils/error.utils';
import { appCheck } from '../../utils/google.utils';
import { assertValidationAsync } from '../../utils/schema.utils';
import { assertIsGuardian } from '../../utils/token.utils';
import { decodeAuth } from '../../utils/wallet.utils';

export const approveProposal = functions
  .runWith({ minInstances: scale(WEN_FUNC.aProposal) })
  .https.onCall(async (req: WenRequest, context) => {
    appCheck(WEN_FUNC.aProposal, context);
    const params = await decodeAuth(req, WEN_FUNC.aProposal);
    const owner = params.address.toLowerCase();
    const schema = Joi.object({ uid: CommonJoi.uid() });
    await assertValidationAsync(schema, params.body);

    const proposalDocRef = admin.firestore().doc(`${COL.PROPOSAL}/${params.body.uid}`);
    const proposal = <Proposal | undefined>(await proposalDocRef.get()).data();
    if (!proposal) {
      throw throwInvalidArgument(WenError.proposal_does_not_exists);
    }

    await assertIsGuardian(proposal.space, owner);

    if (proposal.approved) {
      throw throwInvalidArgument(WenError.proposal_is_already_approved);
    }

    await proposalDocRef.update(uOn({ approved: true, approvedBy: owner }));
    return <Proposal>(await proposalDocRef.get()).data();
  });

export const rejectProposal = functions
  .runWith({ minInstances: scale(WEN_FUNC.rProposal) })
  .https.onCall(async (req: WenRequest, context) => {
    appCheck(WEN_FUNC.rProposal, context);
    const params = await decodeAuth(req, WEN_FUNC.rProposal);
    const owner = params.address.toLowerCase();
    const schema = Joi.object({ uid: CommonJoi.uid() });
    await assertValidationAsync(schema, params.body);

    const proposalDocRef: admin.firestore.DocumentReference = admin
      .firestore()
      .doc(`${COL.PROPOSAL}/${params.body.uid}`);
    const proposal = <Proposal | undefined>(await proposalDocRef.get()).data();
    if (!proposal) {
      throw throwInvalidArgument(WenError.proposal_does_not_exists);
    }

    await assertIsGuardian(proposal.space, owner);

    if (proposal.approved) {
      throw throwInvalidArgument(WenError.proposal_is_already_approved);
    }

    if (proposal.rejected) {
      throw throwInvalidArgument(WenError.proposal_is_already_rejected);
    }

    await proposalDocRef.update(uOn({ rejected: true, rejectedBy: owner }));
    return <Proposal>(await proposalDocRef.get()).data();
  });
