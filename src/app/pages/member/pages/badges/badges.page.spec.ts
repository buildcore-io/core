import { createRoutingFactory, Spectator } from '@ngneat/spectator/jest';
import { BadgeModule } from '../../../../components/badge/badge.module';
import { DataService } from "./../../services/data.service";
import { BadgesPage } from './badges.page';

describe('BadgesPage', () => {
  let spectator: Spectator<BadgesPage>;
  const createComponent = createRoutingFactory({
    component: BadgesPage,
    providers: [ DataService ],
    imports: [ BadgeModule ]
  });

  beforeEach(() => {
    spectator = createComponent();
  });

  it('write tests', () => {
    expect(spectator).toBeDefined();
  });
});
