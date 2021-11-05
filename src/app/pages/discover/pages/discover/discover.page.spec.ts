import { createRoutingFactory, Spectator } from '@ngneat/spectator/jest';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzLayoutModule } from 'ng-zorro-antd/layout';
import { NzMenuModule } from 'ng-zorro-antd/menu';
import { DiscoverPage } from './discover.page';

describe('DiscoverPage', () => {
  let spectator: Spectator<DiscoverPage>;
  const createComponent = createRoutingFactory({
    component: DiscoverPage,
    imports: [ NzInputModule, NzMenuModule, NzLayoutModule ],
  });

  beforeEach(() => {
    spectator = createComponent();
  });

  it('should have button defined', () => {
    expect(spectator.query('button')).toBeDefined();
  });
});
