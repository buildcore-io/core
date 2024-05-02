import { COL, ProposalMember } from '@buildcore/interfaces';
import { get } from 'lodash';
import { Converter } from '../../interfaces/common';
import { PgProposalMembers } from '../../models';
import { removeNulls } from '../common';
import { pgDateToTimestamp } from '../postgres';

export class ProposalMemberConverter implements Converter<ProposalMember, PgProposalMembers> {
  toPg = (pm: ProposalMember): PgProposalMembers => ({
    uid: pm.uid,
    project: pm.project,
    createdOn: pm.createdOn?.toDate(),
    parentId: pm.parentId,
    voted: pm.voted,
    weight: pm.weight,
    tranId: pm.tranId,
    values: (pm.values || []).reduce((acc, act) => {
      const value = Object.keys(act).filter((k) => k !== 'voteTransaction')[0];
      const voteTranId = get(act, 'voteTransaction', '');
      return { ...acc, [voteTranId]: { value, weight: get(act, value, 0) } };
    }, {}),
  });

  fromPg = (pg: PgProposalMembers): ProposalMember =>
    removeNulls({
      uid: pg.uid,
      project: pg.project,
      parentId: pg.parentId,
      parentCol: COL.PROPOSAL,
      createdOn: pgDateToTimestamp(pg.createdOn)!,
      voted: pg.voted,
      weight: pg.weight,
      weightPerAnswer: Object.values(pg.values || {}).reduce(
        (acc: { [key: number]: number }, act: any) => {
          const value = Number(act.value);
          const weight = act.weight;
          return { ...acc, [value]: (acc[value] || 0) + weight };
        },
        {} as { [key: number]: number },
      ),
      tranId: pg.tranId,
      values: Object.entries(pg.values || {}).map(([key, value]) => {
        return {
          [Number(get(value, 'value'))]: get(value, 'weight', 0),
          voteTransaction: key,
        };
      }),
    });
}
