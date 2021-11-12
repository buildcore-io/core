import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NzAvatarModule } from 'ng-zorro-antd/avatar';
import { IconModule } from '../../../ui/components/icon/icon.module';
import { MemberCardComponent } from './member-card.component';


describe('MemberCardComponent', () => {
  let component: MemberCardComponent;
  let fixture: ComponentFixture<MemberCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [MemberCardComponent],
      imports: [IconModule, NzAvatarModule]
    })
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(MemberCardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
