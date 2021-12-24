import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SoonlabsComponent } from './soonlabs.component';

describe('SoonlabsComponent', () => {
  let component: SoonlabsComponent;
  let fixture: ComponentFixture<SoonlabsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ SoonlabsComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(SoonlabsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
