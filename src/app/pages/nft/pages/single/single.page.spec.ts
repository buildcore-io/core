import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SinglePage } from './single.page';

describe('SinglePage', () => {
  let component: SinglePage;
  let fixture: ComponentFixture<SinglePage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ SinglePage ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(SinglePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
