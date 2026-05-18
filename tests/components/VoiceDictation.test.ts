import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import VoiceDictation from '../../src/components/VoiceDictation.vue';

// Mock ComboLockInput
vi.mock('../../src/components/ComboLockInput.vue', () => ({
  default: {
    name: 'ComboLockInput',
    props: ['modelValue', 'digits', 'min', 'max'],
    emits: ['update:modelValue'],
    template: '<div class="mock-combo-lock">{{ modelValue }}</div>',
  },
}));

// Mock SpeechRecognition - add before describe block
class MockSpeechRecognition {
  continuous = false;
  interimResults = false;
  lang = 'en-US';
  onresult: ((event: any) => void) | null = null;
  onerror: ((event: any) => void) | null = null;
  onend: (() => void) | null = null;

  start = vi.fn();
  stop = vi.fn();
  abort = vi.fn();
}

beforeEach(() => {
  (global as any).SpeechRecognition = MockSpeechRecognition;
  (global as any).webkitSpeechRecognition = MockSpeechRecognition;
});

describe('VoiceDictation', () => {
  it('renders in ready state with mic button', () => {
    const wrapper = mount(VoiceDictation);

    expect(wrapper.find('[data-testid="mic-button"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="example-phrase"]').text()).toContain('Speak naturally');
  });

  it('shows empty items list initially', () => {
    const wrapper = mount(VoiceDictation);

    expect(wrapper.find('[data-testid="items-count"]').text()).toContain('0');
  });

  it('starts listening when mic button is clicked', async () => {
    const wrapper = mount(VoiceDictation);

    await wrapper.find('[data-testid="mic-button"]').trigger('click');

    expect(wrapper.find('[data-testid="listening-indicator"]').exists()).toBe(true);
  });

  it('shows live transcript while listening', async () => {
    const wrapper = mount(VoiceDictation);

    await wrapper.find('[data-testid="mic-button"]').trigger('click');

    // Simulate speech result
    const recognition = (wrapper.vm as any).recognition;
    recognition.onresult?.({
      results: [[{ transcript: 'twelve pounds of tomatoes' }]],
      resultIndex: 0,
    });

    await flushPromises();

    expect(wrapper.find('[data-testid="transcript-preview"]').text()).toContain('twelve pounds');
  });

  it('shows not-supported message when Web Speech unavailable', () => {
    delete (global as any).SpeechRecognition;
    delete (global as any).webkitSpeechRecognition;

    const wrapper = mount(VoiceDictation);

    expect(wrapper.find('[data-testid="not-supported"]').exists()).toBe(true);
  });
});
