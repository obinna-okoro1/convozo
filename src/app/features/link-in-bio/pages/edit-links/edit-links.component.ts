/**
 * Edit Links Component
 * Dashboard component for managing creator links (add, edit, delete, reorder, toggle).
 * Supports brand auto-detection from URL and drag-style reorder via up/down buttons.
 */

import { ChangeDetectionStrategy, Component, OnInit, input, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CreatorLink } from '../../../../core/models';
import { ToastService } from '../../../../shared/services/toast.service';
import { LinkService } from '../../services/link.service';
import { detectBrandKey, getBrandByKey, BrandInfo } from '../../utils/brand-detection';

interface LinkForm {
  title: string;
  url: string;
}

@Component({
  selector: 'app-edit-links',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="space-y-6">
      <!-- Header -->
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-xl font-bold text-white">Your Links</h2>
          <p class="text-sm text-slate-400 mt-1">Add, reorder, or toggle your links</p>
        </div>
        <span class="text-xs text-slate-500">{{ links().length }} link{{ links().length !== 1 ? 's' : '' }}</span>
      </div>

      <!-- Add Link Form -->
      <div class="bg-white/5 border border-white/10 rounded-2xl p-4 sm:p-6 backdrop-blur-xl">
        <h3 class="text-sm font-semibold text-slate-300 mb-4">
          {{ editingLink() ? 'Edit Link' : 'Add New Link' }}
        </h3>
        <div class="space-y-3">
          <div>
            <input
              type="url"
              [(ngModel)]="formUrl"
              (ngModelChange)="onUrlChange($event)"
              placeholder="https://youtube.com/your-channel"
              class="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/30 transition-all"
            />
            <!-- Brand detection indicator -->
            @if (detectedBrand()) {
              <div class="flex items-center gap-2 mt-2 text-xs">
                <svg class="w-4 h-4" viewBox="0 0 24 24" [style.fill]="detectedBrand()!.color">
                  <path [attr.d]="detectedBrand()!.svgPath" />
                </svg>
                <span class="text-slate-400">Detected: <span class="font-medium" [style.color]="detectedBrand()!.color">{{ detectedBrand()!.label }}</span></span>
              </div>
            }
          </div>
          <div>
            <input
              type="text"
              [(ngModel)]="formTitle"
              placeholder="Link title (e.g. My YouTube Channel)"
              class="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/30 transition-all"
            />
          </div>
          <div class="flex gap-2">
            <button
              (click)="saveLink()"
              [disabled]="saving() || !formTitle.trim() || !formUrl.trim()"
              class="flex-1 px-4 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold text-sm rounded-xl transition-all duration-300 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed sm:hover:shadow-lg sm:hover:shadow-purple-500/30"
            >
              @if (saving()) {
                <span class="flex items-center justify-center gap-2">
                  <svg class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                  </svg>
                  Saving...
                </span>
              } @else {
                {{ editingLink() ? 'Update Link' : 'Add Link' }}
              }
            </button>
            @if (editingLink()) {
              <button
                (click)="cancelEdit()"
                class="px-4 py-3 bg-white/5 border border-white/10 text-slate-300 font-medium text-sm rounded-xl transition-all duration-300 active:scale-95 hover:bg-white/10"
              >
                Cancel
              </button>
            }
          </div>
        </div>
      </div>

      <!-- Links List -->
      @if (links().length > 0) {
        <div class="space-y-2">
          @for (link of links(); track link.id; let i = $index; let first = $first; let last = $last) {
            <div
              class="group bg-white/5 border rounded-xl p-4 backdrop-blur-xl transition-all duration-200"
              [class.border-white/10]="link.is_active"
              [class.border-white/5]="!link.is_active"
              [class.opacity-50]="!link.is_active"
            >
              <div class="flex items-center gap-3">
                <!-- Reorder buttons -->
                <div class="flex flex-col gap-0.5 flex-shrink-0">
                  <button
                    (click)="moveLink(i, -1)"
                    [disabled]="first || reordering()"
                    class="p-1 text-slate-500 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    title="Move up"
                  >
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
                    </svg>
                  </button>
                  <button
                    (click)="moveLink(i, 1)"
                    [disabled]="last || reordering()"
                    class="p-1 text-slate-500 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    title="Move down"
                  >
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>

                <!-- Brand icon -->
                <div class="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                  [style.background]="getLinkBrand(link)?.color ? getLinkBrand(link)!.color + '20' : 'rgba(255,255,255,0.05)'"
                >
                  @if (getLinkBrand(link); as brand) {
                    <svg class="w-4.5 h-4.5" viewBox="0 0 24 24" [style.fill]="brand.color">
                      <path [attr.d]="brand.svgPath" />
                    </svg>
                  } @else {
                    <svg class="w-4.5 h-4.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                  }
                </div>

                <!-- Link info -->
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-medium text-white truncate">{{ link.title }}</p>
                  <p class="text-xs text-slate-500 truncate">{{ link.url }}</p>
                </div>

                <!-- Click count -->
                <div class="text-center flex-shrink-0 hidden sm:block">
                  <p class="text-sm font-bold text-white">{{ link.click_count }}</p>
                  <p class="text-xs text-slate-500">clicks</p>
                </div>

                <!-- Actions -->
                <div class="flex items-center gap-1 flex-shrink-0">
                  <!-- Toggle active/inactive -->
                  <button
                    (click)="toggleActive(link)"
                    class="p-2 rounded-lg transition-colors min-w-[2.75rem] min-h-[2.75rem] flex items-center justify-center"
                    [class.text-emerald-400]="link.is_active"
                    [class.hover:bg-emerald-500/10]="link.is_active"
                    [class.text-slate-500]="!link.is_active"
                    [class.hover:bg-white/5]="!link.is_active"
                    [title]="link.is_active ? 'Hide link' : 'Show link'"
                  >
                    @if (link.is_active) {
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    } @else {
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    }
                  </button>
                  <!-- Edit -->
                  <button
                    (click)="startEdit(link)"
                    class="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors min-w-[2.75rem] min-h-[2.75rem] flex items-center justify-center"
                    title="Edit link"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <!-- Delete -->
                  <button
                    (click)="deleteLink(link)"
                    class="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors min-w-[2.75rem] min-h-[2.75rem] flex items-center justify-center"
                    title="Delete link"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          }
        </div>
      } @else if (!loading()) {
        <div class="text-center py-12 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-xl">
          <div class="w-16 h-16 bg-purple-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg class="w-8 h-8 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
          </div>
          <h3 class="text-lg font-semibold text-white mb-1">No links yet</h3>
          <p class="text-sm text-slate-400">Add your first link above to get started</p>
        </div>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditLinksComponent implements OnInit {
  /** The creator ID passed in from the parent dashboard */
  readonly creatorId = input.required<string>();

  protected readonly links = signal<CreatorLink[]>([]);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly reordering = signal(false);
  protected readonly editingLink = signal<CreatorLink | null>(null);
  protected readonly detectedBrand = signal<BrandInfo | null>(null);

  // Form fields (simple two-way binding via ngModel)
  protected formTitle = '';
  protected formUrl = '';

  private brandCache = new Map<string, BrandInfo | null>();

  constructor(
    private readonly linkService: LinkService,
    private readonly toast: ToastService,
  ) {}

  ngOnInit(): void {
    void this.loadLinks();
  }

  // ── URL change detection ──────────────────────────────────────────

  protected onUrlChange(url: string): void {
    if (!url.trim()) {
      this.detectedBrand.set(null);
      return;
    }

    // Ensure the URL has a protocol for detection
    let normalizedUrl = url;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      normalizedUrl = 'https://' + url;
    }

    const brandKey = detectBrandKey(normalizedUrl);
    if (brandKey) {
      const brand = getBrandByKey(brandKey);
      this.detectedBrand.set(brand);
      // Auto-fill title if empty and brand is detected
      if (!this.formTitle.trim() && brand) {
        this.formTitle = `My ${brand.label}`;
      }
    } else {
      this.detectedBrand.set(null);
    }
  }

  // ── CRUD ──────────────────────────────────────────────────────────

  protected async saveLink(): Promise<void> {
    if (!this.formTitle.trim() || !this.formUrl.trim()) return;

    this.saving.set(true);

    // Normalise URL
    let url = this.formUrl.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }

    const brandKey = detectBrandKey(url);
    const editing = this.editingLink();

    try {
      if (editing) {
        // Update existing link
        const { error } = await this.linkService.updateLink(editing.id, {
          title: this.formTitle.trim(),
          url,
          icon: brandKey,
        });
        if (error) {
          this.toast.error('Failed to update link');
        } else {
          this.toast.success('Link updated');
          this.cancelEdit();
          await this.loadLinks();
        }
      } else {
        // Create new link
        const position = this.links().length;
        const { error } = await this.linkService.createLink(this.creatorId(), {
          title: this.formTitle.trim(),
          url,
          icon: brandKey,
          position,
        });
        if (error) {
          this.toast.error('Failed to add link');
        } else {
          this.toast.success('Link added');
          this.resetForm();
          await this.loadLinks();
        }
      }
    } catch {
      this.toast.error('Something went wrong');
    } finally {
      this.saving.set(false);
    }
  }

  protected async deleteLink(link: CreatorLink): Promise<void> {
    if (!confirm(`Delete "${link.title}"?`)) return;

    const { error } = await this.linkService.deleteLink(link.id);
    if (error) {
      this.toast.error('Failed to delete link');
    } else {
      this.toast.success('Link deleted');
      await this.loadLinks();
    }
  }

  protected async toggleActive(link: CreatorLink): Promise<void> {
    const { error } = await this.linkService.updateLink(link.id, {
      is_active: !link.is_active,
    });
    if (error) {
      this.toast.error('Failed to update link');
    } else {
      // Update the local signal optimistically
      this.links.update((list) =>
        list.map((l) => (l.id === link.id ? { ...l, is_active: !l.is_active } : l)),
      );
    }
  }

  // ── Edit mode ─────────────────────────────────────────────────────

  protected startEdit(link: CreatorLink): void {
    this.editingLink.set(link);
    this.formTitle = link.title;
    this.formUrl = link.url;
    this.onUrlChange(link.url);
    // Scroll to top of form
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  protected cancelEdit(): void {
    this.editingLink.set(null);
    this.resetForm();
  }

  // ── Reorder ───────────────────────────────────────────────────────

  protected async moveLink(index: number, direction: -1 | 1): Promise<void> {
    const current = [...this.links()];
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= current.length) return;

    // Swap
    [current[index], current[targetIndex]] = [current[targetIndex], current[index]];

    // Update positions
    const reordered = current.map((link, i) => ({ ...link, position: i }));
    this.links.set(reordered);

    this.reordering.set(true);
    const { error } = await this.linkService.reorderLinks(
      reordered.map((l) => ({ id: l.id, position: l.position })),
    );
    this.reordering.set(false);

    if (error) {
      this.toast.error('Failed to reorder');
      await this.loadLinks(); // Revert
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────

  protected getLinkBrand(link: CreatorLink): BrandInfo | null {
    if (!link.icon) return null;
    if (this.brandCache.has(link.icon)) return this.brandCache.get(link.icon)!;
    const brand = getBrandByKey(link.icon);
    this.brandCache.set(link.icon, brand);
    return brand;
  }

  private async loadLinks(): Promise<void> {
    this.loading.set(true);
    const { data } = await this.linkService.getCreatorLinks(this.creatorId());
    this.links.set(data ?? []);
    this.loading.set(false);
  }

  private resetForm(): void {
    this.formTitle = '';
    this.formUrl = '';
    this.detectedBrand.set(null);
  }
}
