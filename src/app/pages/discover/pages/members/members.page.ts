import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  templateUrl: './members.page.html',
  styleUrls: ['./members.page.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MembersPage {
  members = [
    { id: 1, title: 'Adam'} ]
}
