import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'wen-airdrops',
  templateUrl: './airdrops.page.html',
  styleUrls: ['./airdrops.page.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AirdropsPage implements OnInit {

  constructor() { }

  ngOnInit(): void {
  }

}
