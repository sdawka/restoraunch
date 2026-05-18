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
});
