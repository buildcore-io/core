import { createRoutingFactory, Spectator } from '@ngneat/spectator/jest';
import { IconModule } from './../../../../components/icon/icon.module';
import { ContentComponent } from './content.component';


describe('ContentComponent', () => {
  let spectator: Spectator<ContentComponent>;
  const createComponent = createRoutingFactory({
    component: ContentComponent,
    imports: [IconModule]
  });

  beforeEach(() => {
    spectator = createComponent();
  });

  it('write tests', () => {
    expect(spectator).toBeDefined();
  });
});
