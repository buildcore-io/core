import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  templateUrl: './my-profile.page.html',
  styleUrls: ['./my-profile.page.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MyProfilePage {}
