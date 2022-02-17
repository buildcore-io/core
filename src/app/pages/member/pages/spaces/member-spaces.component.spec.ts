import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MemberSpacesComponent } from './member-spaces.component';


describe('MemberSpacesComponent', () => {
  let component: MemberSpacesComponent;
  let fixture: ComponentFixture<MemberSpacesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ MemberSpacesComponent ]
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
