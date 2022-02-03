import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { CollectionCardComponent } from './collection-card.component';



@NgModule({
  declarations: [
    CollectionCardComponent
  ],
  imports: [
    CommonModule
  ],
  exports: [
    CollectionCardComponent
  ]
})
export class CollectionCardModule { }
