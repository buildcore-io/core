import { IconModule } from '@components/icon/icon.module';
import { RadioModule } from '@components/radio/radio.module';
import { createRoutingFactory, Spectator } from '@ngneat/spectator/jest';
import { LayoutModule } from '@shell/ui/layout/layout.module';
import { NewPage } from './new.page';


describe('NewPage', () => {
  let spectator: Spectator<NewPage>;
  const createComponent = createRoutingFactory({
    component: NewPage,
    imports: [IconModule, RadioModule, LayoutModule]
  });

  beforeEach(() => {
    spectator = createComponent();
  });

  it('write tests', () => {
    expect(spectator).toBeDefined();
  });
});
