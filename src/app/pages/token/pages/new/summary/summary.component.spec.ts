import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SpaceApi } from '@api/space.api';
import { CacheService } from '@core/services/cache/cache.service';
import { NewService } from '@pages/token/services/new.service';
import { MockProvider } from 'ng-mocks';
import { NewSummaryComponent } from './summary.component';


describe('NewSummaryComponent', () => {
  let component: NewSummaryComponent;
  let fixture: ComponentFixture<NewSummaryComponent>;

  beforeEach(async() => {
    await TestBed.configureTestingModule({
      declarations: [ NewSummaryComponent ],
      providers: [
        MockProvider(NewService),
        MockProvider(CacheService),
        MockProvider(SpaceApi)
      ]
    })
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(NewSummaryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
