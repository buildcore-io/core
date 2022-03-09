import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TimelineBadgesComponent } from './timeline-badges.component';


describe('TimelineComponent', () => {
  let component: TimelineBadgesComponent;
  let fixture: ComponentFixture<TimelineBadgesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ TimelineBadgesComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(TimelineBadgesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
