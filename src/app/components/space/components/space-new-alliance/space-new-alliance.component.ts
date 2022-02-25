/* eslint-disable @typescript-eslint/adjacent-overload-signatures */
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { FormControl } from '@angular/forms';
import { SelectSpaceOption } from '@components/space/components/select-space/select-space.component';
import { DeviceService } from '@core/services/device';
import { PreviewImageService } from '@core/services/preview-image';
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
  @Input() reputationWeightControl: FormControl = new FormControl(1);

  public get spaces(): Space[] {
    return this._spaces;
  }

  public spaceOptions: SelectSpaceOption[] = [];
  public weightOptions = [
    { label: 'Equal', value: 1 },
    { label: 'Half', value: 0.5 },
    { label: 'Double', value: 2 }
  ];
  private _spaces: Space[] = [];

  constructor(
    public previewImageService: PreviewImageService,
    public deviceService: DeviceService,
    private data: DataService
  ) {}

  public trackByUid(index: number, item: any): number {
    return item.uid;
  }
}
