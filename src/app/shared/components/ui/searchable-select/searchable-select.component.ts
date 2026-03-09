/**
 * Searchable Select Component
 *
 * A custom dropdown with built-in search/filter, keyboard navigation,
 * and dark glassmorphism styling that replaces native <select> elements.
 *
 * Usage:
 *   <app-searchable-select
 *     [options]="bankOptions()"
 *     [(value)]="bankCode"
 *     placeholder="Select your bank"
 *     [searchable]="true"
 *   />
 *
 * Or with event binding:
 *   <app-searchable-select
 *     [options]="filterOptions"
 *     [value]="filterStatus()"
 *     (valueChange)="onFilterChange($event)"
 *   />
 */

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  HostListener,
  input,
  model,
  OnDestroy,
  signal,
  viewChild,
} from '@angular/core';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

@Component({
  selector: 'app-searchable-select',
  standalone: true,
  templateUrl: './searchable-select.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SearchableSelectComponent implements OnDestroy {
  /** The list of options to display. */
  readonly options = input.required<SelectOption[]>();

  /** The currently selected value (two-way bindable via [(value)]). */
  readonly value = model<string>('');

  /** Placeholder text when no option is selected. */
  readonly placeholder = input<string>('Select…');

  /** Whether to show a search input inside the dropdown. */
  readonly searchable = input<boolean>(true);

  /** Optional size variant. */
  readonly size = input<'sm' | 'md'>('md');

  /** Whether the control is disabled. */
  readonly disabled = input<boolean>(false);

  /* ─── Internal state ─── */

  protected readonly isOpen = signal(false);
  protected readonly searchTerm = signal('');
  protected readonly highlightedIndex = signal(-1);

  protected readonly searchInput = viewChild<ElementRef<HTMLInputElement>>('searchInput');

  /** Filtered options based on search term. */
  protected readonly filteredOptions = computed(() => {
    const term = this.searchTerm().toLowerCase().trim();
    const opts = this.options();
    if (!term) return opts;
    return opts.filter((o) => o.label.toLowerCase().includes(term));
  });

  /** The label of the currently selected option. */
  protected readonly selectedLabel = computed(() => {
    const v = this.value();
    const match = this.options().find((o) => o.value === v);
    return match ? match.label : '';
  });

  /* ─── Lifecycle ─── */

  ngOnDestroy(): void {
    // Cleanup if needed
  }

  /* ─── Click outside to close ─── */

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.isOpen()) return;
    const el = this.elementRef.nativeElement as HTMLElement;
    if (!el.contains(event.target as Node)) {
      this.close();
    }
  }

  constructor(private readonly elementRef: ElementRef) {}

  /* ─── Public actions ─── */

  protected toggle(): void {
    if (this.disabled()) return;
    if (this.isOpen()) {
      this.close();
    } else {
      this.open();
    }
  }

  protected open(): void {
    if (this.disabled()) return;
    this.isOpen.set(true);
    this.searchTerm.set('');
    // Pre-highlight the currently selected option
    const idx = this.filteredOptions().findIndex((o) => o.value === this.value());
    this.highlightedIndex.set(idx >= 0 ? idx : 0);
    // Focus the search input after render
    setTimeout(() => this.searchInput()?.nativeElement.focus(), 0);
  }

  protected close(): void {
    this.isOpen.set(false);
    this.searchTerm.set('');
    this.highlightedIndex.set(-1);
  }

  protected selectOption(option: SelectOption): void {
    if (option.disabled) return;
    this.value.set(option.value);
    this.close();
  }

  protected onSearchInput(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    this.searchTerm.set(val);
    this.highlightedIndex.set(0);
  }

  /* ─── Keyboard navigation ─── */

  protected onKeydown(event: KeyboardEvent): void {
    const opts = this.filteredOptions();
    const len = opts.length;
    if (!len) return;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.highlightedIndex.update((i) => (i + 1) % len);
        this.scrollToHighlighted();
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.highlightedIndex.update((i) => (i - 1 + len) % len);
        this.scrollToHighlighted();
        break;
      case 'Enter':
        event.preventDefault();
        if (this.highlightedIndex() >= 0 && this.highlightedIndex() < len) {
          this.selectOption(opts[this.highlightedIndex()]);
        }
        break;
      case 'Escape':
        event.preventDefault();
        this.close();
        break;
    }
  }

  private scrollToHighlighted(): void {
    setTimeout(() => {
      const el = this.elementRef.nativeElement.querySelector('.ss-highlighted');
      el?.scrollIntoView({ block: 'nearest' });
    }, 0);
  }
}
