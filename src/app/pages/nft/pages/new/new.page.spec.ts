import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NewPage } from './new.page';

describe('NewPage', () => {
  let component: NewPage;
  let fixture: ComponentFixture<NewPage>;

  beforeEach(async() => {
    await TestBed.configureTestingModule({
      declarations: [ NewPage ]
    })
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(NewPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
