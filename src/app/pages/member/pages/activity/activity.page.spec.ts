import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivityPage } from './activity.page';


describe('ActivityPage', () => {
  let component: ActivityPage;
  let fixture: ComponentFixture<ActivityPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ActivityPage ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ActivityPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
