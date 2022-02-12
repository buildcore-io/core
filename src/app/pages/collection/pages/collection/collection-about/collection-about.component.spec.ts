import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CollectionAboutComponent } from './collection-about.component';

describe('CollectionAboutComponent', () => {
  let component: CollectionAboutComponent;
  let fixture: ComponentFixture<CollectionAboutComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ CollectionAboutComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(CollectionAboutComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
