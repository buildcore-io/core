import { IconModule } from '@components/icon/icon.module';
import { createComponentFactory, Spectator } from '@ngneat/spectator/jest';
import { MemberEditDrawerComponent } from './member-edit-drawer.component';


describe('MemberEditDrawerComponent', () => {
  let spectator: Spectator<MemberEditDrawerComponent>;
  const createComponent = createComponentFactory({
    component: MemberEditDrawerComponent,
    imports: [IconModule]
  });
  beforeEach(() => {
    spectator = createComponent();
  });

  it('write tests', () => {
    expect(spectator).toBeDefined();
  });
});
