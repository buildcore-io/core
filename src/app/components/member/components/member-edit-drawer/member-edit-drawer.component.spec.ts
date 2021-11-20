import { createComponentFactory, Spectator } from '@ngneat/spectator/jest';
import { MemberEditDrawerComponent } from './member-edit-drawer.component';


describe('MemberEditDrawerComponent', () => {
  let spectator: Spectator<MemberEditDrawerComponent>;
  const createComponent = createComponentFactory({
    component: MemberEditDrawerComponent
  });
  beforeEach(() => {
    spectator = createComponent();
  });

it('write tests', () => {
  expect(spectator).toBeDefined();
});
});
