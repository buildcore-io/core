import { PublicCollections, Space } from '@soonaverse/interfaces';
import { SoonEnv } from '../../Config';
import { CrudRepository } from '../CrudRepository';

export class SpaceRepository extends CrudRepository<Space> {
  constructor(env?: SoonEnv) {
    super(env || SoonEnv.PROD, PublicCollections.SPACE);
  }
}
