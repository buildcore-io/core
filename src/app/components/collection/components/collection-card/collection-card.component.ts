import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'wen-collection-card',
  templateUrl: './collection-card.component.html',
  styleUrls: ['./collection-card.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CollectionCardComponent implements OnInit {

  constructor() { }

  ngOnInit(): void {
  }

}
