import { AfterViewInit, Directive, ElementRef, EventEmitter, OnDestroy, Output } from "@angular/core";

@Directive({ selector: "[wenVisible]" })
export class OnVisibleDirective implements AfterViewInit, OnDestroy {
  @Output() public wenVisible: EventEmitter<any> = new EventEmitter();

  private _intersectionObserver?: IntersectionObserver;

  constructor(private _element: ElementRef) {}

  public ngAfterViewInit() {
    if (IntersectionObserver) {
      this._intersectionObserver = new IntersectionObserver(entries => {
        this.checkForIntersection(entries);
      }, {});
      this._intersectionObserver.observe(<Element> this._element.nativeElement);
    }
  }

  public ngOnDestroy() {
    if (this._intersectionObserver) {
      this._intersectionObserver.disconnect();
    }
  }

  private checkForIntersection = (
    entries: Array<IntersectionObserverEntry>
  ) => {
    entries.forEach((entry: IntersectionObserverEntry) => {
      const isIntersecting =
        (<any>entry).isIntersecting &&
        entry.target === this._element.nativeElement;

      if (isIntersecting) {
        this.wenVisible.emit();
      }
    });
  };
}
