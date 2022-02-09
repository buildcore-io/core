import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { IconModule } from '@components/icon/icon.module';
import { RadioModule } from '@components/radio/radio.module';
import { SelectSpaceModule } from '@components/select-space/select-space.module';
import { LayoutModule } from '@shell/ui/layout/layout.module';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from "ng-zorro-antd/input-number";
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzUploadModule } from 'ng-zorro-antd/upload';
import { CollectionRoutingModule } from './collection-routing.module';
import { CollectionPage } from './pages/collection/collection.page';
import { UpsertPage } from './pages/upsert/upsert.page';
import { DataService } from './services/data.service';



@NgModule({
  declarations: [
    CollectionPage,
    UpsertPage
  ],
  imports: [
    CommonModule,
    CollectionRoutingModule,
    LayoutModule,
    NzButtonModule,
    FormsModule,
    NzInputNumberModule,
    SelectSpaceModule,
    ReactiveFormsModule,
    NzCardModule,
    NzFormModule,
    NzGridModule,
    NzInputModule,
    IconModule,
    NzUploadModule,
    NzSelectModule,
    RadioModule,
    NzRadioModule,
    NzIconModule
  ],
  providers: [
    DataService
  ]
})
export class CollectionModule { }
