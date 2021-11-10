import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MembersIconComponent } from './members.component';


describe('MembersIconComponent', () => {
  let component: MembersIconComponent;
  let fixture: ComponentFixture<MembersIconComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ MembersIconComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(MembersIconComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
