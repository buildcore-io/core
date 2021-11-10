import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';

@Component({
  selector: 'wen-new',
  templateUrl: './new.page.html',
  styleUrls: ['./new.page.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NewPage implements OnInit {

  constructor() { }

  ngOnInit(): void {
  }
}
