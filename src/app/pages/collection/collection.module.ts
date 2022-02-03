import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { LayoutModule } from '@shell/ui/layout/layout.module';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { CollectionRoutingModule } from './collection-routing.module';
import { CollectionPage } from './pages/collection/collection.page';
import { NewPage } from './pages/new/new.page';
import { DataService } from './services/data.service';



@NgModule({
  declarations: [
    CollectionPage,
    NewPage
  ],
  imports: [
    CommonModule,
    CollectionRoutingModule,
    LayoutModule,
    NzButtonModule
  ],
  providers: [
    DataService
  ]
})
export class CollectionModule { }
