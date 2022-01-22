import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MemberReputationModalComponent } from './member-reputation-modal.component';


describe('MemberReputationModalComponent', () => {
  let component: MemberReputationModalComponent;
  let fixture: ComponentFixture<MemberReputationModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ MemberReputationModalComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(MemberReputationModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
