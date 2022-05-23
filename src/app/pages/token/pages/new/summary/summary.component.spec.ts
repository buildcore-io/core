import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SpaceApi } from '@api/space.api';
import { TruncateModule } from '@core/pipes/truncate/truncate.module';
import { CacheService } from '@core/services/cache/cache.service';
import { NewService } from '@pages/token/services/new.service';
import { MockModule, MockProvider } from 'ng-mocks';
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
      ],
      imports: [
        MockModule(TruncateModule)
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
