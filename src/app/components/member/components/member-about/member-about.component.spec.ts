import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MockComponent } from 'ng-mocks';
import { BadgeTileComponent } from '../../../../components/badge/badge-tile/badge-tile.component';
import { MemberEditDrawerComponent } from '../../../../components/member/components/member-edit-drawer/member-edit-drawer.component';
import { MemberAboutComponent } from './member-about.component';


describe('MemberAboutComponent', () => {
  let component: MemberAboutComponent;
  let fixture: ComponentFixture<MemberAboutComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [MemberAboutComponent,
        MockComponent(BadgeTileComponent),
        MockComponent(MemberEditDrawerComponent)]
    })
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(MemberAboutComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
