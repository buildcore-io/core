/* eslint-disable @typescript-eslint/adjacent-overload-signatures */
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { FormControl } from '@angular/forms';
import { SelectBoxOption, SelectBoxSizes } from '@components/select-box/select-box.component';
import { AvatarService } from '@core/services/avatar/avatar.service';
import { Space } from 'functions/interfaces/models';

@Component({
  selector: 'wen-space-new-alliance',
  templateUrl: './space-new-alliance.component.html',
  styleUrls: ['./space-new-alliance.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SpaceNewAllianceComponent {
  @Input() 
  public set spaces(value: Space[]) {
    this.spaceOptions = value.map(space => ({
      label: space.name || '',
      value: space.uid,
      img: this.avatarService.getAvatarSize(space.avatarUrl)
    }));
  }
  @Input() spaceAllianceControl: FormControl = new FormControl('');
  @Input() reputationWeightControl: FormControl = new FormControl(null);

  public get spaces(): Space[] {
    return this._spaces;
  }

  public selectBoxSizes = SelectBoxSizes;
  public spaceOptions: SelectBoxOption[] = [];
  private _spaces: Space[] = [];

  constructor(
    public avatarService: AvatarService
  ) {}
  
  public trackByUid(index: number, item: any): number {
    return item.uid;
  }
}
