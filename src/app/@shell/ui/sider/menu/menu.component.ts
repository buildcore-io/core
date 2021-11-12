import { AfterViewChecked, ChangeDetectionStrategy, Component, ComponentFactoryResolver, Input, QueryList, ViewChildren } from '@angular/core';
import { ThemeService } from '@core/services/theme';
import { MenuItem } from './menu-item';
import { MenuItemDirective } from './menu-item.directive';

@Component({
  selector: 'wen-menu',
  templateUrl: './menu.component.html',
  styleUrls: ['./menu.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MenuComponent implements AfterViewChecked {
  @Input() set items(value: MenuItem[]) {
    this.menuItems = value;
    this.reCreateIcons = true;
  }
  menuItems: MenuItem[] = []
  @ViewChildren(MenuItemDirective) menuItemLabels!: QueryList<MenuItemDirective>;
  private reCreateIcons = false;

  constructor(private themeService: ThemeService, private componentFactoryResolver: ComponentFactoryResolver) { }

  loadIconComponents() {
    if (this.menuItemLabels) {
      for (const itemLabel of this.menuItemLabels.toArray()) {
        const iconComponent = this.componentFactoryResolver.resolveComponentFactory(itemLabel.wenMenuItem?.icon);
        itemLabel.viewContainerRef.clear();
        itemLabel.viewContainerRef.createComponent(iconComponent);
      }
    }
  }

  public ngAfterViewChecked(): void {
    if (this.reCreateIcons) {
      this.loadIconComponents();
      this.reCreateIcons = false;
    }
  }

  public get isDarkTheme() {
    return this.themeService.isDarkTheme()
  }

}
