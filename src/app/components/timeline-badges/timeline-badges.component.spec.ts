import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TimelineBadgeComponent } from './timeline-badges.component';


describe('TimelineComponent', () => {
  let component: TimelineBadgeComponent;
  let fixture: ComponentFixture<TimelineBadgeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ TimelineBadgeComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(TimelineBadgeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
