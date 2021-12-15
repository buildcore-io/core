import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { RadioComponent } from './radio.component';


describe('RadioComponent', () => {
  let component: RadioComponent;
  let fixture: ComponentFixture<RadioComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ RadioComponent ],
      imports: [NzRadioModule]

    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(RadioComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
