import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';

@Component({
  selector: 'wen-yield',
  templateUrl: './yield.page.html',
  styleUrls: ['./yield.page.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class YieldPage implements OnInit {

  constructor() { }

  ngOnInit(): void {
  }

}
