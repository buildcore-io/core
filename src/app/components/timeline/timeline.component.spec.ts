import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SpaceApi } from '@api/space.api';
import { CacheService } from '@core/services/cache/cache.service';
import { MockProvider } from 'ng-mocks';
import { TimelineComponent } from './timeline.component';


describe('TimelineComponent', () => {
  let component: TimelineComponent;
  let fixture: ComponentFixture<TimelineComponent>;

  beforeEach(async() => {
    await TestBed.configureTestingModule({
      declarations: [ TimelineComponent ],
      providers: [
        MockProvider(CacheService),
        MockProvider(SpaceApi)
      ]
    })
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(TimelineComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
