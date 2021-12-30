import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SpaceAboutComponent } from './space-about.component';

describe('SpaceAboutComponent', () => {
  let component: SpaceAboutComponent;
  let fixture: ComponentFixture<SpaceAboutComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ SpaceAboutComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(SpaceAboutComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
