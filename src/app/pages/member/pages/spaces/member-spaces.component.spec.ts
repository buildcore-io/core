import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MemberApi } from '@api/member.api';
import { DataService } from '@pages/member/services/data.service';
import { MockProvider } from 'ng-mocks';
import { MemberSpacesComponent } from './member-spaces.component';


describe('MemberSpacesComponent', () => {
  let component: MemberSpacesComponent;
  let fixture: ComponentFixture<MemberSpacesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ MemberSpacesComponent ],
      providers: [
        MockProvider(DataService),
        MockProvider(MemberApi)
      ]
    })
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(MemberSpacesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
