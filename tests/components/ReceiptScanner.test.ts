import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, flushPromises, VueWrapper } from '@vue/test-utils';
import ReceiptScanner from '../../src/components/ReceiptScanner.vue';

// Mock child components to simplify testing
vi.mock('../../src/components/ReceiptItemRow.vue', () => ({
  default: {
    name: 'ReceiptItemRow',
    props: ['item', 'index', 'selected'],
    emits: ['toggle', 'update:item'],
    template: `
      <div class="mock-item-row" :data-index="index" :data-selected="selected" @click="$emit('toggle', index)">
        {{ item.name }}
      </div>
    `,
  },
}));

vi.mock('../../src/components/OcrHints.vue', () => ({
  default: {
    name: 'OcrHints',
    template: '<div class="mock-ocr-hints">OCR Hints</div>',
  },
}));

vi.mock('../../src/components/VoiceDictation.vue', () => ({
  default: {
    name: 'VoiceDictation',
    emits: ['done', 'cancel'],
    template: '<div class="mock-voice-dictation" @click="$emit(\'done\', [])">Voice Mode</div>',
  },
}));

// Mock URL.createObjectURL and revokeObjectURL
const mockCreateObjectURL = vi.fn(() => 'blob:mock-url');
const mockRevokeObjectURL = vi.fn();
global.URL.createObjectURL = mockCreateObjectURL;
global.URL.revokeObjectURL = mockRevokeObjectURL;

// Helper to create mock File
function createMockFile(name = 'receipt.jpg', type = 'image/jpeg'): File {
  const blob = new Blob(['mock image data'], { type });
  return new File([blob], name, { type });
}

// Helper to create mock scan response
function createScanResponse(options: {
  isPartial?: boolean;
  items?: Array<{
    name: string;
    quantity: number;
    unit: string;
    unitCost: number;
    matchedInventoryItemId: number | null;
    matchConfidence: number;
  }>;
} = {}) {
  return {
    photoUrl: 'https://example.com/receipt.jpg',
    photoUrls: ['https://example.com/receipt.jpg'],
    supplier: 'Test Supplier',
    items: options.items ?? [
      {
        name: 'Test Item 1',
        quantity: 10,
        unit: 'EA',
        unitCost: 5.99,
        matchedInventoryItemId: 1,
        matchConfidence: 0.95,
        matchReason: 'exact match',
      },
      {
        name: 'Test Item 2',
        quantity: 5,
        unit: 'LB',
        unitCost: 12.50,
        matchedInventoryItemId: 2,
        matchConfidence: 0.8,
        matchReason: 'fuzzy match',
      },
      {
        name: 'New Item',
        quantity: 2,
        unit: 'CS',
        unitCost: 25.00,
        matchedInventoryItemId: null,
        matchConfidence: 0,
        matchReason: '',
      },
    ],
    total: 172.40,
    date: '2026-05-16',
    isPartial: options.isPartial ?? false,
  };
}

describe('ReceiptScanner', () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    mockFetch = vi.fn();
    global.fetch = mockFetch;

    // Default: suppliers endpoint returns empty
    mockFetch.mockImplementation((url: string) => {
      if (url === '/api/suppliers') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([]),
        });
      }
      return Promise.resolve({ ok: false, json: () => Promise.resolve({ error: 'Not found' }) });
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('Initial render (ready state)', () => {
    it('renders in ready state by default', async () => {
      const wrapper = mount(ReceiptScanner);
      await flushPromises();

      expect(wrapper.find('.receipt-scanner').exists()).toBe(true);
      // Initial state shows mode selection; click photo to reach ready state
      await wrapper.find('[data-testid="mode-photo"]').trigger('click');
      expect(wrapper.find('.ready-state').exists()).toBe(true);
      expect(wrapper.find('.upload-zone').exists()).toBe(true);
    });

    it('displays header with title', async () => {
      const wrapper = mount(ReceiptScanner);
      await flushPromises();

      expect(wrapper.find('.header-title').text()).toBe('Receipt Scanner');
      expect(wrapper.find('.header-subtitle').text()).toBe('Scan to update stock');
    });

    it('shows state indicator with Upload active', async () => {
      const wrapper = mount(ReceiptScanner);
      await flushPromises();
      await wrapper.find('[data-testid="mode-photo"]').trigger('click');

      const steps = wrapper.findAll('.state-step');
      expect(steps).toHaveLength(3);
      expect(steps[0].classes()).toContain('active');
    });

    it('does not show reset button in ready state', async () => {
      const wrapper = mount(ReceiptScanner);
      await flushPromises();

      expect(wrapper.find('.reset-btn').exists()).toBe(false);
    });

    it('shows upload zone with correct text', async () => {
      const wrapper = mount(ReceiptScanner);
      await flushPromises();
      await wrapper.find('[data-testid="mode-photo"]').trigger('click');

      expect(wrapper.find('.upload-text').text()).toBe('Drop receipt image here');
      expect(wrapper.find('.upload-subtext').text()).toBe('or click to browse');
    });
  });

  describe('File upload triggers scanning state', () => {
    it('transitions to scanning state when file is uploaded', async () => {
      const wrapper = mount(ReceiptScanner);
      await flushPromises();
      await wrapper.find('[data-testid="mode-photo"]').trigger('click');

      // Mock scan response that never resolves to keep in scanning state
      mockFetch.mockImplementation((url: string) => {
        if (url === '/api/receipts/scan') {
          return new Promise(() => {}); // Never resolves
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      });

      // Simulate file input change
      const fileInput = wrapper.find('input[type="file"]');
      const mockFile = createMockFile();

      Object.defineProperty(fileInput.element, 'files', {
        value: [mockFile],
        writable: false,
      });

      await fileInput.trigger('change');
      await wrapper.vm.$nextTick();

      // Should be in scanning state
      expect(wrapper.find('.scanning-state').exists()).toBe(true);
      expect(wrapper.find('.scanning-text').text()).toBe('Analyzing receipt...');
    });

    it('shows scanning animation', async () => {
      const wrapper = mount(ReceiptScanner);
      await flushPromises();
      await wrapper.find('[data-testid="mode-photo"]').trigger('click');

      mockFetch.mockImplementation((url: string) => {
        if (url === '/api/receipts/scan') {
          return new Promise(() => {}); // Never resolves to keep in scanning state
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      });

      const fileInput = wrapper.find('input[type="file"]');
      Object.defineProperty(fileInput.element, 'files', {
        value: [createMockFile()],
        writable: false,
      });

      await fileInput.trigger('change');

      expect(wrapper.find('.scan-animation').exists()).toBe(true);
      expect(wrapper.find('.scan-document').exists()).toBe(true);
      expect(wrapper.find('.scan-line').exists()).toBe(true);
    });

    it('calls /api/receipts/scan with FormData', async () => {
      const wrapper = mount(ReceiptScanner);
      await flushPromises();
      await wrapper.find('[data-testid="mode-photo"]').trigger('click');

      mockFetch.mockImplementation((url: string, options?: RequestInit) => {
        if (url === '/api/receipts/scan') {
          expect(options?.method).toBe('POST');
          expect(options?.body).toBeInstanceOf(FormData);
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(createScanResponse()),
          });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      });

      const fileInput = wrapper.find('input[type="file"]');
      Object.defineProperty(fileInput.element, 'files', {
        value: [createMockFile()],
        writable: false,
      });

      await fileInput.trigger('change');
      await flushPromises();

      expect(mockFetch).toHaveBeenCalledWith('/api/receipts/scan', expect.any(Object));
    });
  });

  describe('Drag-and-drop file handling', () => {
    it('shows drag-over styling when dragging over upload zone', async () => {
      const wrapper = mount(ReceiptScanner);
      await flushPromises();
      await wrapper.find('[data-testid="mode-photo"]').trigger('click');

      const uploadZone = wrapper.find('.upload-zone');
      await uploadZone.trigger('dragover');

      expect(uploadZone.classes()).toContain('drag-over');
    });

    it('removes drag-over styling on drag leave', async () => {
      const wrapper = mount(ReceiptScanner);
      await flushPromises();
      await wrapper.find('[data-testid="mode-photo"]').trigger('click');

      const uploadZone = wrapper.find('.upload-zone');
      await uploadZone.trigger('dragover');
      expect(uploadZone.classes()).toContain('drag-over');

      // Simulate leaving the zone (relatedTarget outside)
      const event = new DragEvent('dragleave', {
        bubbles: true,
        relatedTarget: document.body,
      });
      uploadZone.element.dispatchEvent(event);
      await flushPromises();

      expect(wrapper.find('.upload-zone').classes()).not.toContain('drag-over');
    });

    it('handles file drop and triggers scan', async () => {
      const wrapper = mount(ReceiptScanner);
      await flushPromises();
      await wrapper.find('[data-testid="mode-photo"]').trigger('click');

      mockFetch.mockImplementation((url: string) => {
        if (url === '/api/receipts/scan') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(createScanResponse()),
          });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      });

      const uploadZone = wrapper.find('.upload-zone');
      const mockFile = createMockFile();

      // Create drop event with files
      const dataTransfer = {
        files: [mockFile],
      };

      await uploadZone.trigger('drop', { dataTransfer });
      await flushPromises();

      expect(mockFetch).toHaveBeenCalledWith('/api/receipts/scan', expect.any(Object));
    });

    it('filters non-image files on drop', async () => {
      const wrapper = mount(ReceiptScanner);
      await flushPromises();
      await wrapper.find('[data-testid="mode-photo"]').trigger('click');

      const uploadZone = wrapper.find('.upload-zone');
      const textFile = new File(['text'], 'document.txt', { type: 'text/plain' });

      const dataTransfer = {
        files: [textFile],
      };

      await uploadZone.trigger('drop', { dataTransfer });
      await flushPromises();

      // Should not trigger scan since no image files
      expect(mockFetch).not.toHaveBeenCalledWith('/api/receipts/scan', expect.any(Object));
    });

    it('handles multiple image files on drop', async () => {
      const wrapper = mount(ReceiptScanner);
      await flushPromises();
      await wrapper.find('[data-testid="mode-photo"]').trigger('click');

      let formDataImages: File[] = [];
      mockFetch.mockImplementation((url: string, options?: RequestInit) => {
        if (url === '/api/receipts/scan') {
          const formData = options?.body as FormData;
          formDataImages = formData.getAll('images') as File[];
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(createScanResponse()),
          });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      });

      const uploadZone = wrapper.find('.upload-zone');
      const dataTransfer = {
        files: [
          createMockFile('receipt1.jpg'),
          createMockFile('receipt2.jpg'),
          createMockFile('receipt3.png', 'image/png'),
        ],
      };

      await uploadZone.trigger('drop', { dataTransfer });
      await flushPromises();

      expect(formDataImages).toHaveLength(3);
    });
  });

  describe('Multi-image accumulation', () => {
    it('shows captured images count after upload', async () => {
      const wrapper = mount(ReceiptScanner);
      await flushPromises();
      await wrapper.find('[data-testid="mode-photo"]').trigger('click');

      mockFetch.mockImplementation((url: string) => {
        if (url === '/api/receipts/scan') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(createScanResponse()),
          });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      });

      const fileInput = wrapper.find('input[type="file"]');
      Object.defineProperty(fileInput.element, 'files', {
        value: [createMockFile()],
        writable: false,
      });

      await fileInput.trigger('change');
      await flushPromises();

      // After scan completes, go back to ready with addMorePhotos
      await wrapper.vm.addMorePhotos();
      await flushPromises();

      expect(wrapper.find('.captured-count').exists()).toBe(true);
      expect(wrapper.find('.captured-count').text()).toContain('1 photo');
    });

    it('displays thumbnail strip with captured images', async () => {
      const wrapper = mount(ReceiptScanner);
      await flushPromises();
      await wrapper.find('[data-testid="mode-photo"]').trigger('click');

      mockFetch.mockImplementation((url: string) => {
        if (url === '/api/receipts/scan') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ ...createScanResponse(), isPartial: true }),
          });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      });

      const fileInput = wrapper.find('input[type="file"]');
      Object.defineProperty(fileInput.element, 'files', {
        value: [createMockFile()],
        writable: false,
      });

      await fileInput.trigger('change');
      await flushPromises();

      // Go back to ready state
      await wrapper.vm.addMorePhotos();
      await flushPromises();

      expect(wrapper.find('.thumbnail-strip').exists()).toBe(true);
      expect(wrapper.findAll('.thumbnail-item')).toHaveLength(1);
    });

    it('allows removing captured images', async () => {
      const wrapper = mount(ReceiptScanner);
      await flushPromises();
      await wrapper.find('[data-testid="mode-photo"]').trigger('click');

      mockFetch.mockImplementation((url: string) => {
        if (url === '/api/receipts/scan') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ ...createScanResponse(), isPartial: true }),
          });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      });

      const fileInput = wrapper.find('input[type="file"]');
      Object.defineProperty(fileInput.element, 'files', {
        value: [createMockFile()],
        writable: false,
      });

      await fileInput.trigger('change');
      await flushPromises();

      await wrapper.vm.addMorePhotos();
      await flushPromises();

      expect(wrapper.findAll('.thumbnail-item')).toHaveLength(1);

      // Click remove button
      const removeBtn = wrapper.find('.thumbnail-remove');
      await removeBtn.trigger('click');
      await flushPromises();

      expect(wrapper.findAll('.thumbnail-item')).toHaveLength(0);
      expect(mockRevokeObjectURL).toHaveBeenCalled();
    });
  });

  describe('State transitions through the flow', () => {
    it('transitions from scanning to reviewing on successful scan', async () => {
      const wrapper = mount(ReceiptScanner);
      await flushPromises();
      await wrapper.find('[data-testid="mode-photo"]').trigger('click');

      mockFetch.mockImplementation((url: string) => {
        if (url === '/api/receipts/scan') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(createScanResponse()),
          });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      });

      const fileInput = wrapper.find('input[type="file"]');
      Object.defineProperty(fileInput.element, 'files', {
        value: [createMockFile()],
        writable: false,
      });

      await fileInput.trigger('change');
      await flushPromises();

      expect(wrapper.find('.review-state').exists()).toBe(true);
    });

    it('transitions to confirming state when confirm is clicked', async () => {
      const wrapper = mount(ReceiptScanner);
      await flushPromises();
      await wrapper.find('[data-testid="mode-photo"]').trigger('click');

      mockFetch.mockImplementation((url: string) => {
        if (url === '/api/receipts/scan') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(createScanResponse()),
          });
        }
        if (url === '/api/receipts/confirm') {
          return new Promise(() => {}); // Keep in confirming state
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      });

      const fileInput = wrapper.find('input[type="file"]');
      Object.defineProperty(fileInput.element, 'files', {
        value: [createMockFile()],
        writable: false,
      });

      await fileInput.trigger('change');
      await flushPromises();

      // Items should be auto-selected
      const confirmBtn = wrapper.find('.confirm-btn');
      await confirmBtn.trigger('click');
      await flushPromises();

      expect(wrapper.find('.loading-spinner').exists()).toBe(true);
    });

    it('transitions to confirmed state on successful confirmation', async () => {
      const wrapper = mount(ReceiptScanner);
      await flushPromises();
      await wrapper.find('[data-testid="mode-photo"]').trigger('click');

      mockFetch.mockImplementation((url: string) => {
        if (url === '/api/receipts/scan') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(createScanResponse()),
          });
        }
        if (url === '/api/receipts/confirm') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ success: true }),
          });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      });

      const fileInput = wrapper.find('input[type="file"]');
      Object.defineProperty(fileInput.element, 'files', {
        value: [createMockFile()],
        writable: false,
      });

      await fileInput.trigger('change');
      await flushPromises();

      const confirmBtn = wrapper.find('.confirm-btn');
      await confirmBtn.trigger('click');
      await flushPromises();

      expect(wrapper.find('.confirmed-state').exists()).toBe(true);
      expect(wrapper.find('.success-text').text()).toBe('Inventory Updated!');
    });

    it('resets to ready state after confirmed delay', async () => {
      const wrapper = mount(ReceiptScanner);
      await flushPromises();
      await wrapper.find('[data-testid="mode-photo"]').trigger('click');

      mockFetch.mockImplementation((url: string) => {
        if (url === '/api/receipts/scan') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(createScanResponse()),
          });
        }
        if (url === '/api/receipts/confirm') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ success: true }),
          });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      });

      const fileInput = wrapper.find('input[type="file"]');
      Object.defineProperty(fileInput.element, 'files', {
        value: [createMockFile()],
        writable: false,
      });

      await fileInput.trigger('change');
      await flushPromises();

      await wrapper.find('.confirm-btn').trigger('click');
      await flushPromises();

      expect(wrapper.find('.confirmed-state').exists()).toBe(true);

      // Advance timers for the auto-reset
      vi.advanceTimersByTime(3000);
      await flushPromises();

      expect(wrapper.find('.ready-state').exists()).toBe(true);
    });
  });

  describe('Item selection', () => {
    async function mountWithItems(): Promise<VueWrapper> {
      const wrapper = mount(ReceiptScanner);
      await flushPromises();
      await wrapper.find('[data-testid="mode-photo"]').trigger('click');

      mockFetch.mockImplementation((url: string) => {
        if (url === '/api/receipts/scan') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(createScanResponse()),
          });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      });

      const fileInput = wrapper.find('input[type="file"]');
      Object.defineProperty(fileInput.element, 'files', {
        value: [createMockFile()],
        writable: false,
      });

      await fileInput.trigger('change');
      await flushPromises();

      return wrapper;
    }

    it('auto-selects high confidence items after scan', async () => {
      const wrapper = await mountWithItems();

      // Items with matchConfidence >= 0.7 or matchedInventoryItemId !== null should be selected
      const selectionCount = wrapper.find('.selection-count');
      expect(selectionCount.text()).toContain('2 of 3 selected'); // First two items have matches
    });

    it('toggles item selection when clicked', async () => {
      const wrapper = await mountWithItems();

      const items = wrapper.findAll('.mock-item-row');
      expect(items).toHaveLength(3);

      // First item should be selected (has high confidence match)
      expect(items[0].attributes('data-selected')).toBe('true');

      // Toggle it off
      await items[0].trigger('click');
      await flushPromises();

      expect(wrapper.find('.selection-count').text()).toContain('1 of 3 selected');
    });

    it('selects all items when selectAll is clicked', async () => {
      const wrapper = await mountWithItems();

      const selectAllBtn = wrapper.findAll('.select-btn').find((btn) => btn.text() === 'All');
      await selectAllBtn!.trigger('click');
      await flushPromises();

      expect(wrapper.find('.selection-count').text()).toContain('3 of 3 selected');
    });

    it('deselects all items when deselectAll is clicked', async () => {
      const wrapper = await mountWithItems();

      const deselectBtn = wrapper.findAll('.select-btn').find((btn) => btn.text() === 'None');
      await deselectBtn!.trigger('click');
      await flushPromises();

      expect(wrapper.find('.selection-count').text()).toContain('0 of 3 selected');
    });

    it('calculates total for selected items', async () => {
      const wrapper = await mountWithItems();

      // Select all to get full total
      const selectAllBtn = wrapper.findAll('.select-btn').find((btn) => btn.text() === 'All');
      await selectAllBtn!.trigger('click');
      await flushPromises();

      // Total = (10 * 5.99) + (5 * 12.50) + (2 * 25.00) = 59.90 + 62.50 + 50.00 = 172.40
      const totalValue = wrapper.find('.total-value');
      expect(totalValue.text()).toBe('$172.40');
    });
  });

  describe('Partial receipt handling (incomplete state)', () => {
    it('shows incomplete state when isPartial is true', async () => {
      const wrapper = mount(ReceiptScanner);
      await flushPromises();
      await wrapper.find('[data-testid="mode-photo"]').trigger('click');

      mockFetch.mockImplementation((url: string) => {
        if (url === '/api/receipts/scan') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ ...createScanResponse(), isPartial: true }),
          });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      });

      const fileInput = wrapper.find('input[type="file"]');
      Object.defineProperty(fileInput.element, 'files', {
        value: [createMockFile()],
        writable: false,
      });

      await fileInput.trigger('change');
      await flushPromises();

      expect(wrapper.find('.incomplete-state').exists()).toBe(true);
      expect(wrapper.find('.incomplete-title').text()).toBe('Partial Receipt Detected');
    });

    it('shows stats in incomplete state', async () => {
      const wrapper = mount(ReceiptScanner);
      await flushPromises();
      await wrapper.find('[data-testid="mode-photo"]').trigger('click');

      mockFetch.mockImplementation((url: string) => {
        if (url === '/api/receipts/scan') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ ...createScanResponse(), isPartial: true }),
          });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      });

      const fileInput = wrapper.find('input[type="file"]');
      Object.defineProperty(fileInput.element, 'files', {
        value: [createMockFile()],
        writable: false,
      });

      await fileInput.trigger('change');
      await flushPromises();

      const stats = wrapper.findAll('.stat-item');
      expect(stats[0].text()).toContain('1 photo');
      expect(stats[1].text()).toContain('3 items found');
    });

    it('addMorePhotos returns to ready state', async () => {
      const wrapper = mount(ReceiptScanner);
      await flushPromises();
      await wrapper.find('[data-testid="mode-photo"]').trigger('click');

      mockFetch.mockImplementation((url: string) => {
        if (url === '/api/receipts/scan') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ ...createScanResponse(), isPartial: true }),
          });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      });

      const fileInput = wrapper.find('input[type="file"]');
      Object.defineProperty(fileInput.element, 'files', {
        value: [createMockFile()],
        writable: false,
      });

      await fileInput.trigger('change');
      await flushPromises();

      expect(wrapper.find('.incomplete-state').exists()).toBe(true);

      const addMoreBtn = wrapper.find('.add-more-btn');
      await addMoreBtn.trigger('click');
      await flushPromises();

      expect(wrapper.find('.ready-state').exists()).toBe(true);
    });

    it('continueWithPartial proceeds to reviewing state', async () => {
      const wrapper = mount(ReceiptScanner);
      await flushPromises();
      await wrapper.find('[data-testid="mode-photo"]').trigger('click');

      mockFetch.mockImplementation((url: string) => {
        if (url === '/api/receipts/scan') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ ...createScanResponse(), isPartial: true }),
          });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      });

      const fileInput = wrapper.find('input[type="file"]');
      Object.defineProperty(fileInput.element, 'files', {
        value: [createMockFile()],
        writable: false,
      });

      await fileInput.trigger('change');
      await flushPromises();

      const continueBtn = wrapper.find('.continue-btn');
      await continueBtn.trigger('click');
      await flushPromises();

      expect(wrapper.find('.review-state').exists()).toBe(true);
    });
  });

  describe('Error state display and retry', () => {
    it('shows error state when scan fails', async () => {
      const wrapper = mount(ReceiptScanner);
      await flushPromises();
      await wrapper.find('[data-testid="mode-photo"]').trigger('click');

      mockFetch.mockImplementation((url: string) => {
        if (url === '/api/receipts/scan') {
          return Promise.resolve({
            ok: false,
            json: () => Promise.resolve({ error: 'Failed to process image' }),
          });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      });

      const fileInput = wrapper.find('input[type="file"]');
      Object.defineProperty(fileInput.element, 'files', {
        value: [createMockFile()],
        writable: false,
      });

      await fileInput.trigger('change');
      await flushPromises();

      expect(wrapper.find('.error-state').exists()).toBe(true);
      expect(wrapper.find('.error-text').text()).toBe('Failed to process image');
    });

    it('shows error state on network error', async () => {
      const wrapper = mount(ReceiptScanner);
      await flushPromises();
      await wrapper.find('[data-testid="mode-photo"]').trigger('click');

      mockFetch.mockImplementation((url: string) => {
        if (url === '/api/receipts/scan') {
          return Promise.reject(new Error('Network error'));
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      });

      const fileInput = wrapper.find('input[type="file"]');
      Object.defineProperty(fileInput.element, 'files', {
        value: [createMockFile()],
        writable: false,
      });

      await fileInput.trigger('change');
      await flushPromises();

      expect(wrapper.find('.error-state').exists()).toBe(true);
      expect(wrapper.find('.error-text').text()).toBe('Network error');
    });

    it('retry button resets scanner', async () => {
      const wrapper = mount(ReceiptScanner);
      await flushPromises();
      await wrapper.find('[data-testid="mode-photo"]').trigger('click');

      mockFetch.mockImplementation((url: string) => {
        if (url === '/api/receipts/scan') {
          return Promise.resolve({
            ok: false,
            json: () => Promise.resolve({ error: 'Error' }),
          });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      });

      const fileInput = wrapper.find('input[type="file"]');
      Object.defineProperty(fileInput.element, 'files', {
        value: [createMockFile()],
        writable: false,
      });

      await fileInput.trigger('change');
      await flushPromises();

      expect(wrapper.find('.error-state').exists()).toBe(true);

      const retryBtn = wrapper.find('.retry-btn');
      await retryBtn.trigger('click');
      await flushPromises();

      expect(wrapper.find('.ready-state').exists()).toBe(true);
    });
  });

  describe('Confirm button disabled when no items selected', () => {
    it('disables confirm button when no items selected', async () => {
      const wrapper = mount(ReceiptScanner);
      await flushPromises();
      await wrapper.find('[data-testid="mode-photo"]').trigger('click');

      mockFetch.mockImplementation((url: string) => {
        if (url === '/api/receipts/scan') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(createScanResponse()),
          });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      });

      const fileInput = wrapper.find('input[type="file"]');
      Object.defineProperty(fileInput.element, 'files', {
        value: [createMockFile()],
        writable: false,
      });

      await fileInput.trigger('change');
      await flushPromises();

      // Deselect all items
      const deselectBtn = wrapper.findAll('.select-btn').find((btn) => btn.text() === 'None');
      await deselectBtn!.trigger('click');
      await flushPromises();

      const confirmBtn = wrapper.find('.confirm-btn');
      expect(confirmBtn.attributes('disabled')).toBeDefined();
    });

    it('enables confirm button when items are selected', async () => {
      const wrapper = mount(ReceiptScanner);
      await flushPromises();
      await wrapper.find('[data-testid="mode-photo"]').trigger('click');

      mockFetch.mockImplementation((url: string) => {
        if (url === '/api/receipts/scan') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(createScanResponse()),
          });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      });

      const fileInput = wrapper.find('input[type="file"]');
      Object.defineProperty(fileInput.element, 'files', {
        value: [createMockFile()],
        writable: false,
      });

      await fileInput.trigger('change');
      await flushPromises();

      // Items should be auto-selected
      const confirmBtn = wrapper.find('.confirm-btn');
      expect(confirmBtn.attributes('disabled')).toBeUndefined();
    });

    it('shows error when trying to confirm with only new items selected', async () => {
      const wrapper = mount(ReceiptScanner);
      await flushPromises();
      await wrapper.find('[data-testid="mode-photo"]').trigger('click');

      mockFetch.mockImplementation((url: string) => {
        if (url === '/api/receipts/scan') {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve(
                createScanResponse({
                  items: [
                    {
                      name: 'New Item Only',
                      quantity: 2,
                      unit: 'EA',
                      unitCost: 10.0,
                      matchedInventoryItemId: null,
                      matchConfidence: 0,
                    },
                  ],
                })
              ),
          });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      });

      const fileInput = wrapper.find('input[type="file"]');
      Object.defineProperty(fileInput.element, 'files', {
        value: [createMockFile()],
        writable: false,
      });

      await fileInput.trigger('change');
      await flushPromises();

      // Select the new item
      const selectAllBtn = wrapper.findAll('.select-btn').find((btn) => btn.text() === 'All');
      await selectAllBtn!.trigger('click');
      await flushPromises();

      await wrapper.find('.confirm-btn').trigger('click');
      await flushPromises();

      // Should show error about no matched items
      expect(wrapper.vm.error).toBe('No matched items to confirm');
    });
  });

  describe('Reset/cancel functionality', () => {
    it('shows reset button in non-ready states', async () => {
      const wrapper = mount(ReceiptScanner);
      await flushPromises();
      await wrapper.find('[data-testid="mode-photo"]').trigger('click');

      mockFetch.mockImplementation((url: string) => {
        if (url === '/api/receipts/scan') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(createScanResponse()),
          });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      });

      const fileInput = wrapper.find('input[type="file"]');
      Object.defineProperty(fileInput.element, 'files', {
        value: [createMockFile()],
        writable: false,
      });

      await fileInput.trigger('change');
      await flushPromises();

      expect(wrapper.find('.reset-btn').exists()).toBe(true);
    });

    it('reset button returns to ready state and clears data', async () => {
      const wrapper = mount(ReceiptScanner);
      await flushPromises();
      await wrapper.find('[data-testid="mode-photo"]').trigger('click');

      mockFetch.mockImplementation((url: string) => {
        if (url === '/api/receipts/scan') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(createScanResponse()),
          });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      });

      const fileInput = wrapper.find('input[type="file"]');
      Object.defineProperty(fileInput.element, 'files', {
        value: [createMockFile()],
        writable: false,
      });

      await fileInput.trigger('change');
      await flushPromises();

      expect(wrapper.find('.review-state').exists()).toBe(true);

      const resetBtn = wrapper.find('.reset-btn');
      await resetBtn.trigger('click');
      await flushPromises();

      expect(wrapper.find('.ready-state').exists()).toBe(true);
      expect(wrapper.vm.scanResult).toBeNull();
      expect(wrapper.vm.capturedImages).toHaveLength(0);
    });

    it('clears all captured image URLs on reset', async () => {
      const wrapper = mount(ReceiptScanner);
      await flushPromises();
      await wrapper.find('[data-testid="mode-photo"]').trigger('click');

      mockFetch.mockImplementation((url: string) => {
        if (url === '/api/receipts/scan') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(createScanResponse()),
          });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      });

      const fileInput = wrapper.find('input[type="file"]');
      Object.defineProperty(fileInput.element, 'files', {
        value: [createMockFile()],
        writable: false,
      });

      await fileInput.trigger('change');
      await flushPromises();

      const revokeCallsBefore = mockRevokeObjectURL.mock.calls.length;

      await wrapper.find('.reset-btn').trigger('click');
      await flushPromises();

      expect(mockRevokeObjectURL.mock.calls.length).toBeGreaterThan(revokeCallsBefore);
    });
  });

  describe('onInventoryUpdated callback', () => {
    it('calls onInventoryUpdated prop when receipt is confirmed', async () => {
      const onInventoryUpdated = vi.fn();
      const wrapper = mount(ReceiptScanner, {
        props: {
          onInventoryUpdated,
        },
      });
      await flushPromises();
      await wrapper.find('[data-testid="mode-photo"]').trigger('click');

      mockFetch.mockImplementation((url: string) => {
        if (url === '/api/receipts/scan') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(createScanResponse()),
          });
        }
        if (url === '/api/receipts/confirm') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ success: true }),
          });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      });

      const fileInput = wrapper.find('input[type="file"]');
      Object.defineProperty(fileInput.element, 'files', {
        value: [createMockFile()],
        writable: false,
      });

      await fileInput.trigger('change');
      await flushPromises();

      await wrapper.find('.confirm-btn').trigger('click');
      await flushPromises();

      expect(onInventoryUpdated).toHaveBeenCalledOnce();
    });
  });

  describe('Supplier selection', () => {
    it('loads suppliers on mount', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url === '/api/suppliers') {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve([
                { id: 1, name: 'Sysco' },
                { id: 2, name: 'US Foods' },
              ]),
          });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      });

      const wrapper = mount(ReceiptScanner);
      await flushPromises();

      expect(wrapper.vm.suppliers).toHaveLength(2);
    });

    it('shows supplier select dropdown when suppliers are loaded', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url === '/api/suppliers') {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve([
                { id: 1, name: 'Sysco' },
                { id: 2, name: 'Test Supplier' },
              ]),
          });
        }
        if (url === '/api/receipts/scan') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(createScanResponse()),
          });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      });

      const wrapper = mount(ReceiptScanner);
      await flushPromises();
      await wrapper.find('[data-testid="mode-photo"]').trigger('click');

      const fileInput = wrapper.find('input[type="file"]');
      Object.defineProperty(fileInput.element, 'files', {
        value: [createMockFile()],
        writable: false,
      });

      await fileInput.trigger('change');
      await flushPromises();

      expect(wrapper.find('.supplier-select').exists()).toBe(true);
    });

    it('auto-selects matching supplier from extracted name', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url === '/api/suppliers') {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve([
                { id: 1, name: 'Sysco' },
                { id: 2, name: 'Test Supplier' },
              ]),
          });
        }
        if (url === '/api/receipts/scan') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(createScanResponse()),
          });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      });

      const wrapper = mount(ReceiptScanner);
      await flushPromises();
      await wrapper.find('[data-testid="mode-photo"]').trigger('click');

      const fileInput = wrapper.find('input[type="file"]');
      Object.defineProperty(fileInput.element, 'files', {
        value: [createMockFile()],
        writable: false,
      });

      await fileInput.trigger('change');
      await flushPromises();

      // Scan response has supplier: 'Test Supplier'
      expect(wrapper.vm.selectedSupplierId).toBe(2);
    });
  });

  describe('Merge info display', () => {
    it('shows merge info when multiple photos processed', async () => {
      const wrapper = mount(ReceiptScanner);
      await flushPromises();
      await wrapper.find('[data-testid="mode-photo"]').trigger('click');

      mockFetch.mockImplementation((url: string) => {
        if (url === '/api/receipts/scan') {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                ...createScanResponse(),
                mergeInfo: {
                  photosProcessed: 3,
                  itemsBeforeDedup: 15,
                  duplicatesRemoved: 5,
                },
              }),
          });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      });

      const fileInput = wrapper.find('input[type="file"]');
      Object.defineProperty(fileInput.element, 'files', {
        value: [createMockFile()],
        writable: false,
      });

      await fileInput.trigger('change');
      await flushPromises();

      expect(wrapper.find('.merge-badge').exists()).toBe(true);
      expect(wrapper.find('.merge-badge').text()).toContain('3 photos merged');
      expect(wrapper.find('.dedup-badge').exists()).toBe(true);
      expect(wrapper.find('.dedup-badge').text()).toContain('5 duplicates removed');
    });
  });

  describe('Mode Selection', () => {
    it('shows mode selection cards in initial state', () => {
      const wrapper = mount(ReceiptScanner);

      expect(wrapper.find('[data-testid="mode-photo"]').exists()).toBe(true);
      expect(wrapper.find('[data-testid="mode-voice"]').exists()).toBe(true);
    });

    it('switches to photo mode when photo card clicked', async () => {
      const wrapper = mount(ReceiptScanner);

      await wrapper.find('[data-testid="mode-photo"]').trigger('click');

      expect(wrapper.find('[data-testid="upload-area"]').exists()).toBe(true);
      expect(wrapper.find('[data-testid="mode-photo"]').exists()).toBe(false);
    });

    it('switches to voice mode when voice card clicked', async () => {
      const wrapper = mount(ReceiptScanner);

      await wrapper.find('[data-testid="mode-voice"]').trigger('click');

      expect(wrapper.find('.mock-voice-dictation').exists()).toBe(true);
    });
  });
});
