import { AfterViewInit, ChangeDetectionStrategy, Component, ComponentFactoryResolver, Input, OnInit, QueryList, ViewChildren } from '@angular/core';
import { ThemeService } from '@core/services/theme';
import { MenuItem } from './menu-item';
import { MenuItemDirective } from './menu-item.directive';

@Component({
  selector: 'wen-menu',
  templateUrl: './menu.component.html',
  styleUrls: ['./menu.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MenuComponent implements OnInit, AfterViewInit {
  @Input() items: MenuItem[] = []

  @ViewChildren(MenuItemDirective) menuItemLabels!: QueryList<MenuItemDirective>;

  constructor(private themeService: ThemeService, private componentFactoryResolver: ComponentFactoryResolver) { }

  ngOnInit() {
    if (!this.menuItemLabels) {
      return
    }

    for (const itemLabel of this.menuItemLabels.toArray()) {
      itemLabel.viewContainerRef.clear()
    }
  }

  ngAfterViewInit() {
    if (!this.menuItemLabels) {
      return
    }

    for (const itemLabel of this.menuItemLabels.toArray()) {
      const iconComponent = this.componentFactoryResolver.resolveComponentFactory(itemLabel.wenMenuItem?.icon);
      itemLabel.viewContainerRef.createComponent(iconComponent);
    }
  }

  public get isDarkTheme() {
    return this.themeService.isDarkTheme()
  }

}
