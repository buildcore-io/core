import { IconModule } from '@components/icon/icon.module';
import { RadioModule } from '@components/radio/radio.module';
import { createRoutingFactory, Spectator } from '@ngneat/spectator/jest';
import { LayoutModule } from '@shell/ui/layout/layout.module';
import { UpsertPage } from './upsert.page';

describe('UpsertPage', () => {
  let spectator: Spectator<UpsertPage>;
  const createComponent = createRoutingFactory({
    component: UpsertPage,
    imports: [IconModule, RadioModule, LayoutModule]
  });

  beforeEach(() => {
    spectator = createComponent();
  });

  it('write tests', () => {
    expect(spectator).toBeDefined();
  });
});
