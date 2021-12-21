import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { AwardCardModule } from '@components/award/components/award-card/award-card.module';
import { FrameModule } from '@components/frame/frame.module';
import { IconModule } from '@components/icon/icon.module';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { SpaceCardModule } from './../../components/space/components/space-card/space-card.module';
import { HomePage } from './home.page';

@NgModule({
  declarations: [HomePage],
  imports: [
    CommonModule,
    RouterModule.forChild([
      {
        path: '',
        component: HomePage,
        data: {
          title: 'Home',
          description: 'The Soonaverse is a decentralized platform for communities, enabling the seamless creation, management, and interoperability of DAOs.',
          robots: 'index, follow',
        },
      },
    ]),
    NzButtonModule,
    AwardCardModule,
    SpaceCardModule,
    NzIconModule,
    IconModule,
    FrameModule
  ],
})
export class HomeModule { }
