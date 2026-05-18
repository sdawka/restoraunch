import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import ComboLockInput from '../../src/components/ComboLockInput.vue';

describe('ComboLockInput', () => {
  it('renders digits for the given value', () => {
    const wrapper = mount(ComboLockInput, {
      props: { modelValue: 12, digits: 2 },
    });

    const digitElements = wrapper.findAll('[data-testid="digit"]');
    expect(digitElements).toHaveLength(2);
    expect(digitElements[0].text()).toBe('1');
    expect(digitElements[1].text()).toBe('2');
  });
});
