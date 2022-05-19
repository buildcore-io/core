import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NewService } from '@pages/token/services/new.service';
import { MockProvider } from 'ng-mocks';
import { NewOverviewComponent } from './overview.component';


describe('NewOverviewComponent', () => {
  let component: NewOverviewComponent;
  let fixture: ComponentFixture<NewOverviewComponent>;

  beforeEach(async() => {
    await TestBed.configureTestingModule({
      declarations: [ NewOverviewComponent ],
      providers: [
        MockProvider(NewService)
      ]
    })
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(NewOverviewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
