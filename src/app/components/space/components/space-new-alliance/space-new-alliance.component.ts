import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { FormControl } from '@angular/forms';
import { FileApi } from '@api/file.api';
import { Space } from 'functions/interfaces/models';
import { FILE_SIZES } from 'functions/interfaces/models/base';

@Component({
  selector: 'wen-space-new-alliance',
  templateUrl: './space-new-alliance.component.html',
  styleUrls: ['./space-new-alliance.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SpaceNewAllianceComponent {
  @Input() spaces: Space[] = [];
  @Input() spaceAllianceControl: FormControl = new FormControl('');
  @Input() reputationWeightControl: FormControl = new FormControl(null);
  
  public trackByUid(index: number, item: any): number {
    return item.uid;
  }

  public getAvatarSize(url?: string|null): string|undefined {
    if (!url) {
      return undefined;
    }

    return FileApi.getUrl(url, 'space_avatar', FILE_SIZES.small);
  }
}
