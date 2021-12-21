import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SoonaverseComponent } from './soonaverse.component';

describe('SoonaverseComponent', () => {
  let component: SoonaverseComponent;
  let fixture: ComponentFixture<SoonaverseComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ SoonaverseComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(SoonaverseComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
