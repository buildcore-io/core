import { AwardParticipant, PublicCollections, PublicSubCollections } from '@soonaverse/interfaces';
import { SoonEnv } from '../../Config';
import { SubCrudRepository } from '../SubCrudRepository';

export class AwardParticipantRepository extends SubCrudRepository<AwardParticipant> {
  constructor(env?: SoonEnv) {
    super(env || SoonEnv.PROD, PublicCollections.AWARD, PublicSubCollections.PARTICIPANTS);
  }
}
