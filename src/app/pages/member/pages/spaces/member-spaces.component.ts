import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
import { DeviceService } from '@core/services/device';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { DataService } from './../../services/data.service';

@UntilDestroy()
@Component({
  selector: 'wen-member-spaces',
  templateUrl: './member-spaces.component.html',
  styleUrls: ['./member-spaces.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MemberSpacesComponent implements OnInit {
  public spaceForm: FormGroup;
  public spacesList = [];
  public shownSpaces: any[] = [];
  public includeAlliancesDisabled = false;
  public isSearchInputFocused = false;

  constructor(
    public data: DataService,
    public deviceService: DeviceService
  ) {
    this.spaceForm = new FormGroup({
      space: new FormControl(''),
      includeAlliances: new FormControl(false)
    });
    this.shownSpaces = this.spacesList;
  }

  ngOnInit(): void {
    this.spaceForm.controls.space.valueChanges
      .pipe(untilDestroyed(this))
      .subscribe(this.onSearchValueChange.bind(this));
  }

  public onSearchValueChange(): void {
    const searchValue = this.spaceForm.controls.space.value;
    this.shownSpaces = this.spacesList.filter((space: any) => { space.name.toLowerCase().includes(searchValue.toLowerCase()) });
  }

  public onEraseClick(): void {
    this.spaceForm.controls.space.setValue('');
    this.onSearchValueChange();
  }
}
