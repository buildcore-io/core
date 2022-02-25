import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MultiplePage } from './multiple.page';

describe('MultiplePage', () => {
  let component: MultiplePage;
  let fixture: ComponentFixture<MultiplePage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ MultiplePage ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(MultiplePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
