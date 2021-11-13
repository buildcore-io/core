import { createComponentFactory, Spectator } from '@ngneat/spectator/jest';
import { MembersIconComponent } from './members.component';


describe('MembersIconComponent', () => {
  let spectator: Spectator<MembersIconComponent>;
  const createComponent = createComponentFactory({
    component: MembersIconComponent
  });

  beforeEach(() => {
    spectator = createComponent();
  });

it('write tests', () => {
  expect(spectator).toBeDefined();
});
});
