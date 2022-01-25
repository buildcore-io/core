import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';

@UntilDestroy()
@Component({
  selector: 'wen-member-spaces',
  templateUrl: './member-spaces.component.html',
  styleUrls: ['./member-spaces.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MemberSpacesComponent implements OnInit {
  public spaceForm: FormGroup;
  
  public spacesList = [
    { img: 'https://icons.iconarchive.com/icons/martz90/circle/24/video-camera-icon.png', name: 'IOTA Pioneers1', awards: 3, XP: 550 },
    { img: 'https://icons.iconarchive.com/icons/martz90/circle/24/video-camera-icon.png', name: 'IOTA Pioneers2', awards: 3, XP: 550 },
    { img: 'https://icons.iconarchive.com/icons/martz90/circle/24/video-camera-icon.png', name: 'IOTA Pioneers3', awards: 3, XP: 550 },
    { img: 'https://icons.iconarchive.com/icons/martz90/circle/24/video-camera-icon.png', name: 'IOTA Pioneers4', awards: 3, XP: 550 },
    { img: 'https://icons.iconarchive.com/icons/martz90/circle/24/video-camera-icon.png', name: 'IOTA Pioneers5', awards: 3, XP: 550 },
    { img: 'https://icons.iconarchive.com/icons/martz90/circle/24/video-camera-icon.png', name: 'IOTA Pioneers6', awards: 3, XP: 550 },
    { img: 'https://icons.iconarchive.com/icons/martz90/circle/24/video-camera-icon.png', name: 'IOTA Pioneers7', awards: 3, XP: 550 },
    { img: 'https://icons.iconarchive.com/icons/martz90/circle/24/video-camera-icon.png', name: 'IOTA Pioneers8', awards: 3, XP: 550 },
    { img: 'https://icons.iconarchive.com/icons/martz90/circle/24/video-camera-icon.png', name: 'IOTA Pioneer9', awards: 3, XP: 550 },
    { img: 'https://icons.iconarchive.com/icons/martz90/circle/24/video-camera-icon.png', name: 'IOTA Pioneers10', awards: 3, XP: 550 },
    { img: 'https://icons.iconarchive.com/icons/martz90/circle/24/video-camera-icon.png', name: 'IOTA Pioneers11', awards: 3, XP: 550 },
    { img: 'https://icons.iconarchive.com/icons/martz90/circle/24/video-camera-icon.png', name: 'IOTA Pioneers', awards: 3, XP: 550 },
    { img: 'https://icons.iconarchive.com/icons/martz90/circle/24/video-camera-icon.png', name: 'IOTA Pioneers', awards: 3, XP: 550 },
    { img: 'https://icons.iconarchive.com/icons/martz90/circle/24/video-camera-icon.png', name: 'IOTA Pioneers', awards: 3, XP: 550 },
    { img: 'https://icons.iconarchive.com/icons/martz90/circle/24/video-camera-icon.png', name: 'IOTA Pioneers', awards: 3, XP: 550 },
    { img: 'https://icons.iconarchive.com/icons/martz90/circle/24/video-camera-icon.png', name: 'IOTA Pioneers', awards: 3, XP: 550 },
    { img: 'https://icons.iconarchive.com/icons/martz90/circle/24/video-camera-icon.png', name: 'IOTA Pioneers', awards: 3, XP: 550 },
    { img: 'https://icons.iconarchive.com/icons/martz90/circle/24/video-camera-icon.png', name: 'IOTA Pioneers', awards: 3, XP: 550 },
    { img: 'https://icons.iconarchive.com/icons/martz90/circle/24/video-camera-icon.png', name: 'IOTA Pioneers', awards: 3, XP: 550 },
    { img: 'https://icons.iconarchive.com/icons/martz90/circle/24/video-camera-icon.png', name: 'IOTA Pioneers', awards: 3, XP: 550 },
    { img: 'https://icons.iconarchive.com/icons/martz90/circle/24/video-camera-icon.png', name: 'IOTA Pioneers', awards: 3, XP: 550 },
    { img: 'https://icons.iconarchive.com/icons/martz90/circle/24/video-camera-icon.png', name: 'IOTA Pioneers', awards: 3, XP: 550 },
    { img: 'https://icons.iconarchive.com/icons/martz90/circle/24/video-camera-icon.png', name: 'IOTA Pioneers', awards: 3, XP: 550 },
    { img: 'https://icons.iconarchive.com/icons/martz90/circle/24/video-camera-icon.png', name: 'IOTA Pioneers', awards: 3, XP: 550 },
    { img: 'https://icons.iconarchive.com/icons/martz90/circle/24/video-camera-icon.png', name: 'IOTA Pioneers', awards: 3, XP: 550 },
    { img: 'https://icons.iconarchive.com/icons/martz90/circle/24/video-camera-icon.png', name: 'IOTA Pioneers', awards: 3, XP: 550 },
    { img: 'https://icons.iconarchive.com/icons/martz90/circle/24/video-camera-icon.png', name: 'IOTA Pioneers', awards: 3, XP: 550 },
    { img: 'https://icons.iconarchive.com/icons/martz90/circle/24/video-camera-icon.png', name: 'IOTA Pioneers', awards: 3, XP: 550 },
    { img: 'https://icons.iconarchive.com/icons/martz90/circle/24/video-camera-icon.png', name: 'IOTA Pioneers', awards: 3, XP: 550 }
  ];
  public shownSpaces: any[] = [];
  public includeAlliancesDisabled = false;

  constructor(
    private cd: ChangeDetectorRef
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
    this.shownSpaces = this.spacesList.filter(space => space.name.toLowerCase().includes(searchValue.toLowerCase()));
  }

  public onEraseClick(): void {
    this.spaceForm.controls.space.setValue('');
    this.onSearchValueChange();
  }
}
