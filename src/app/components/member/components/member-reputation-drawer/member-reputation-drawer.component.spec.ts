import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MemberReputationDrawerComponent } from './member-reputation-drawer.component';


describe('MemberReputationDrawerComponent', () => {
  let component: MemberReputationDrawerComponent;
  let fixture: ComponentFixture<MemberReputationDrawerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [MemberReputationDrawerComponent]
    })
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(MemberReputationDrawerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
