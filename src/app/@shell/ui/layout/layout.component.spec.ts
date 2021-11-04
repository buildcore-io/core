import { createRoutingFactory, Spectator } from '@ngneat/spectator/jest';
import { MockComponent } from 'ng-mocks';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzLayoutModule } from 'ng-zorro-antd/layout';
import { FooterComponent } from "../footer/footer.component";
import { HeaderComponent } from "../header/header.component";
import { SiderComponent } from './../sider/sider.component';
import { LayoutComponent } from './layout.component';

describe('LayoutComponent', () => {
  let spectator: Spectator<LayoutComponent>;
  const createComponent = createRoutingFactory({
    component: LayoutComponent,
    imports: [NzLayoutModule, NzIconModule],
    declarations: [
      MockComponent(HeaderComponent),
      MockComponent(FooterComponent),
      MockComponent(SiderComponent)
    ],
    params: {},
    data: {}
  });

  beforeEach(() => {
    spectator = createComponent();
  });

  it('write tests', () => {
    expect(spectator).toBeDefined();
  });
});
