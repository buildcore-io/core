import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CollectionAccessBadgeComponent } from './collection-access-badge.component';

describe('CollectionAccessBadgeComponent', () => {
  let component: CollectionAccessBadgeComponent;
  let fixture: ComponentFixture<CollectionAccessBadgeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ CollectionAccessBadgeComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(CollectionAccessBadgeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
