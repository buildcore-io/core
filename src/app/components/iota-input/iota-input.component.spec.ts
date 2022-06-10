import { ComponentFixture, TestBed } from '@angular/core/testing';
import { IotaInputComponent } from './iota-input.component';


describe('IotaInputComponent', () => {
  let component: IotaInputComponent;
  let fixture: ComponentFixture<IotaInputComponent>;

  beforeEach(async() => {
    await TestBed.configureTestingModule({
      declarations: [ IotaInputComponent ]
    })
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(IotaInputComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
