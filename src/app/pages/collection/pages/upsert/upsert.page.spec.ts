import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UpsertPage } from './upsert.page';

describe('UpsertPage', () => {
  let component: UpsertPage;
  let fixture: ComponentFixture<UpsertPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ UpsertPage ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(UpsertPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
