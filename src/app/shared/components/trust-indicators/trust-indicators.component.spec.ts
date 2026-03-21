/**
 * Unit tests for TrustIndicatorsComponent
 * A presentational component — tests focus on render presence.
 */

import { TestBed, ComponentFixture } from '@angular/core/testing';
import { TrustIndicatorsComponent } from './trust-indicators.component';

describe('TrustIndicatorsComponent', () => {
  let fixture: ComponentFixture<TrustIndicatorsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TrustIndicatorsComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TrustIndicatorsComponent);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('renders at least one element in the DOM', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.children.length).toBeGreaterThan(0);
  });
});
