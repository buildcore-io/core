import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UnamusedComponent } from './unamused.component';

describe('UnamusedComponent', () => {
  let component: UnamusedComponent;
  let fixture: ComponentFixture<UnamusedComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ UnamusedComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(UnamusedComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
