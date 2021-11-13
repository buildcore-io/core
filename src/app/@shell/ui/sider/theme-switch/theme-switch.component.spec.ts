import { createComponentFactory, Spectator } from '@ngneat/spectator/jest';
import { IconModule } from './../../../../components/ui/components/icon/icon.module';
import { ThemeSwitchComponent } from './theme-switch.component';


describe('ThemeSwitchComponent', () => {
  let spectator: Spectator<ThemeSwitchComponent>;
  const createComponent = createComponentFactory({
    component: ThemeSwitchComponent,
    imports: [IconModule]
  });

  beforeEach(() => {
    spectator = createComponent();
  });

it('write tests', () => {
  expect(spectator).toBeDefined();
});
});
