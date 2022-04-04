import { createComponentFactory, Spectator } from '@ngneat/spectator/jest';
import { QuestionCircleIconComponent } from './question-circle.component';


describe('QuestionCircleIconComponent', () => {
  let spectator: Spectator<QuestionCircleIconComponent>;
  const createComponent = createComponentFactory({
    component: QuestionCircleIconComponent
  });

  beforeEach(() => {
    spectator = createComponent();
  });

  it('write tests', () => {
    expect(spectator).toBeDefined();
  });
});
