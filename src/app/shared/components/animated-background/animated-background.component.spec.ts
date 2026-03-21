/**
 * Unit tests for AnimatedBackgroundComponent
 * A presentational component — tests focus on render presence and host element.
 */

import { TestBed, ComponentFixture } from '@angular/core/testing';
import { AnimatedBackgroundComponent } from './animated-background.component';

describe('AnimatedBackgroundComponent', () => {
  let fixture: ComponentFixture<AnimatedBackgroundComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AnimatedBackgroundComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(AnimatedBackgroundComponent);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('renders the host element in the DOM', () => {
    const el = fixture.nativeElement as HTMLElement;
    // The component uses OnPush; even an empty template keeps the host element
    expect(el).toBeTruthy();
  });
});
