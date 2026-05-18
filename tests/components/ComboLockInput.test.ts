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

  it('increments digit on drag up', async () => {
    const wrapper = mount(ComboLockInput, {
      props: { modelValue: 12, digits: 2 },
    });

    const secondDigit = wrapper.findAll('[data-testid="digit"]')[1];

    // Simulate drag up (negative deltaY = up)
    await secondDigit.trigger('pointerdown', { clientY: 100 });
    await secondDigit.trigger('pointermove', { clientY: 70 }); // 30px up
    await secondDigit.trigger('pointerup');

    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([13]);
  });

  it('decrements digit on drag down', async () => {
    const wrapper = mount(ComboLockInput, {
      props: { modelValue: 15, digits: 2 },
    });

    const secondDigit = wrapper.findAll('[data-testid="digit"]')[1];

    await secondDigit.trigger('pointerdown', { clientY: 100 });
    await secondDigit.trigger('pointermove', { clientY: 130 }); // 30px down
    await secondDigit.trigger('pointerup');

    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([14]);
  });

  it('respects min/max bounds', async () => {
    const wrapper = mount(ComboLockInput, {
      props: { modelValue: 99, digits: 2, max: 99 },
    });

    const secondDigit = wrapper.findAll('[data-testid="digit"]')[1];

    await secondDigit.trigger('pointerdown', { clientY: 100 });
    await secondDigit.trigger('pointermove', { clientY: 70 });
    await secondDigit.trigger('pointerup');

    // Should not emit since already at max
    expect(wrapper.emitted('update:modelValue')).toBeUndefined();
  });
});
