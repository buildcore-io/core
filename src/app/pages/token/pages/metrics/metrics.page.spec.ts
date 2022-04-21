import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MetricsPage } from './metrics.page';


describe('MetricsPage', () => {
  let component: MetricsPage;
  let fixture: ComponentFixture<MetricsPage>;

  beforeEach(async() => {
    await TestBed.configureTestingModule({
      declarations: [ MetricsPage ]
    })
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(MetricsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
