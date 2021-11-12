import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BadgeTileComponent } from './badge-tile.component';

describe('BadgeTileComponent', () => {
  let component: BadgeTileComponent;
  let fixture: ComponentFixture<BadgeTileComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ BadgeTileComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(BadgeTileComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
