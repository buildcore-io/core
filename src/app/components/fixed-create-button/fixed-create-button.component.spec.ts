import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FixedCreateButtonComponent } from './fixed-create-button.component';

describe('FixedCreateButtonComponent', () => {
  let component: FixedCreateButtonComponent;
  let fixture: ComponentFixture<FixedCreateButtonComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ FixedCreateButtonComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(FixedCreateButtonComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
