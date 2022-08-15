import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TransactionStepsComponent } from './transaction-steps.component';

describe('TransactionStepsComponent', () => {
  let component: TransactionStepsComponent;
  let fixture: ComponentFixture<TransactionStepsComponent>;

  beforeEach(async() => {
    await TestBed.configureTestingModule({
      declarations: [ TransactionStepsComponent ]
    })
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(TransactionStepsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
