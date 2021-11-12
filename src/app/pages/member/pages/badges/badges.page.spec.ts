import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BadgesPage } from './badges.page';


describe('BadgesPage', () => {
  let component: BadgesPage;
  let fixture: ComponentFixture<BadgesPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ BadgesPage ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(BadgesPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
