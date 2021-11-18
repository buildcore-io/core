import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { NzLayoutModule } from 'ng-zorro-antd/layout';
import { FooterModule } from '../footer/footer.module';
import { HeaderModule } from '../header/header.module';
import { SiderModule } from '../sider/sider.module';
import { LayoutComponent } from './layout.component';

@NgModule({
  declarations: [LayoutComponent],
  imports: [
    CommonModule,
    HeaderModule,
    FooterModule,
    NzLayoutModule,
    SiderModule
  ],
  exports: [LayoutComponent],
})
export class LayoutModule {

}
