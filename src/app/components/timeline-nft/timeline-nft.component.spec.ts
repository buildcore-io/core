import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TimelineNftComponent } from './timeline-nft.component';


describe('TimelineNftComponent', () => {
  let component: TimelineNftComponent;
  let fixture: ComponentFixture<TimelineNftComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ TimelineNftComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(TimelineNftComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
