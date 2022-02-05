/* eslint-disable @typescript-eslint/adjacent-overload-signatures */
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { FormControl } from '@angular/forms';
import { SelectSpaceOption } from '@components/select-space/select-space.component';
import { AvatarService } from '@core/services/avatar';
import { DataService } from '@pages/space/services/data.service';
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
    const currentSpaceUid = this.data.space$.getValue()?.uid;
    
    this.spaceOptions =
      value
        .filter(space => space.uid !== currentSpaceUid)
        .map(space => ({
          label: space.name || '',
          value: space.uid,
          img: space.avatarUrl
        }));
  }
  @Input() spaceAllianceControl: FormControl = new FormControl('');
  @Input() reputationWeightControl: FormControl = new FormControl(null);

  public get spaces(): Space[] {
    return this._spaces;
  }

  public spaceOptions: SelectSpaceOption[] = [];
  private _spaces: Space[] = [];

  constructor(
    public avatarService: AvatarService,
    private data: DataService
  ) {}
  
  public trackByUid(index: number, item: any): number {
    return item.uid;
  }
}
