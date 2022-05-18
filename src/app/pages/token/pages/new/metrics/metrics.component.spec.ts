import { DecimalPipe } from '@angular/common';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NewService } from '@pages/token/services/new.service';
import { MockProvider } from 'ng-mocks';
import { NewMetricsComponent } from './metrics.component';


describe('MetricsComponent', () => {
  let component: NewMetricsComponent;
  let fixture: ComponentFixture<NewMetricsComponent>;

  beforeEach(async() => {
    await TestBed.configureTestingModule({
      declarations: [ NewMetricsComponent ],
      providers: [
        MockProvider(NewService),
        MockProvider(DecimalPipe)
      ]
    })
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(NewMetricsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
