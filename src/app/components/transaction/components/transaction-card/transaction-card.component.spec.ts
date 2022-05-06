import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TransactionCardComponent } from './transaction-card.component';


describe('TransactionCardComponent', () => {
  let component: TransactionCardComponent;
  let fixture: ComponentFixture<TransactionCardComponent>;

  beforeEach(async() => {
    await TestBed.configureTestingModule({
      declarations: [ TransactionCardComponent ]
    })
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(TransactionCardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
