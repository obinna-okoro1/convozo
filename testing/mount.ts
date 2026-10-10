import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Type } from '@angular/core';

export interface MountedElement {
  click(): void;
  type(value: string): void;
  toHaveValue(value: string): void;
  toHaveClass(value: string): void;
  toHaveInnerText(value: string): void;
  getComponent<T>(): T;
}

export interface MountedSut<T> {
  get(selector: string): MountedElement;
  getComponent(): T;
  getFixture(): ComponentFixture<T>;
}

class ElementHarness implements MountedElement {
  public constructor(private readonly element: HTMLElement) {}

  public click(): void { this.element.click(); }

  public type(value: string): void {
    const input = this.element as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
  }

  public toHaveValue(value: string): void { expect((this.element as HTMLInputElement).value).toBe(value); }
  public toHaveClass(value: string): void { expect(this.element.classList).toContain(value); }
  public toHaveInnerText(value: string): void { expect(this.element.innerText).toBe(value); }
  public getComponent<T>(): T { return (this.element as unknown as { __ngContext__: { 8: T } }).__ngContext__[8]; }
}

export async function mount<T>(component: Type<T>, metadata: Parameters<typeof TestBed.configureTestingModule>[0] = {}, cb?: (sut: MountedSut<T>) => void): Promise<MountedSut<T>> {
  await TestBed.configureTestingModule({ imports: [component], ...metadata }).compileComponents();
  const fixture = TestBed.createComponent(component);
  fixture.detectChanges();
  const sut: MountedSut<T> = {
    get: selector => new ElementHarness(fixture.nativeElement.querySelector(selector) as HTMLElement),
    getComponent: () => fixture.componentInstance,
    getFixture: () => fixture,
  };
  cb?.(sut);
  return sut;
}
