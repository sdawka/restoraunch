import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import AnimatedNumber from '../../src/components/AnimatedNumber.vue';

describe('AnimatedNumber', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Default: reduced motion is off
    vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('renders with initial value', async () => {
    const wrapper = mount(AnimatedNumber, {
      props: {
        value: 100,
      },
    });

    // Initially should show 0 before animation
    expect(wrapper.find('.value').exists()).toBe(true);
    expect(wrapper.find('.animated-number').exists()).toBe(true);
  });

  it('displays prefix correctly', () => {
    const wrapper = mount(AnimatedNumber, {
      props: {
        value: 100,
        prefix: '$',
      },
    });

    expect(wrapper.find('.prefix').exists()).toBe(true);
    expect(wrapper.find('.prefix').text()).toBe('$');
  });

  it('displays suffix correctly', () => {
    const wrapper = mount(AnimatedNumber, {
      props: {
        value: 100,
        suffix: '%',
      },
    });

    expect(wrapper.find('.suffix').exists()).toBe(true);
    expect(wrapper.find('.suffix').text()).toBe('%');
  });

  it('displays both prefix and suffix together', () => {
    const wrapper = mount(AnimatedNumber, {
      props: {
        value: 50,
        prefix: '$',
        suffix: 'USD',
      },
    });

    expect(wrapper.find('.prefix').text()).toBe('$');
    expect(wrapper.find('.suffix').text()).toBe('USD');
  });

  it('hides prefix when not provided', () => {
    const wrapper = mount(AnimatedNumber, {
      props: {
        value: 100,
      },
    });

    expect(wrapper.find('.prefix').exists()).toBe(false);
  });

  it('hides suffix when not provided', () => {
    const wrapper = mount(AnimatedNumber, {
      props: {
        value: 100,
      },
    });

    expect(wrapper.find('.suffix').exists()).toBe(false);
  });

  it('handles value changes', async () => {
    const wrapper = mount(AnimatedNumber, {
      props: {
        value: 0,
      },
    });

    await wrapper.setProps({ value: 100 });
    await flushPromises();

    // The component should have started animating to new value
    expect(wrapper.vm.displayValue).toBeDefined();
  });

  it('respects reduced motion preference', async () => {
    // Mock reduced motion preference
    vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    const wrapper = mount(AnimatedNumber, {
      props: {
        value: 100,
        duration: 1000,
      },
    });

    await flushPromises();

    // With reduced motion, value should immediately be set without animation
    expect(wrapper.vm.prefersReducedMotion).toBe(true);
    expect(wrapper.vm.displayValue).toBe(100);
  });

  it('formats decimals correctly', async () => {
    vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    const wrapper = mount(AnimatedNumber, {
      props: {
        value: 99.567,
        decimals: 2,
      },
    });

    await flushPromises();

    expect(wrapper.find('.value').text()).toBe('99.57');
  });

  it('handles zero value', () => {
    const wrapper = mount(AnimatedNumber, {
      props: {
        value: 0,
      },
    });

    expect(wrapper.find('.value').exists()).toBe(true);
  });

  it('handles negative values', async () => {
    vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    const wrapper = mount(AnimatedNumber, {
      props: {
        value: -50,
      },
    });

    await flushPromises();

    expect(wrapper.vm.displayValue).toBe(-50);
  });

  it('uses default duration when not specified', () => {
    const wrapper = mount(AnimatedNumber, {
      props: {
        value: 100,
      },
    });

    // Default duration is 1000ms (defined in component)
    expect(wrapper.props('duration')).toBe(1000);
  });

  it('accepts custom duration', () => {
    const wrapper = mount(AnimatedNumber, {
      props: {
        value: 100,
        duration: 500,
      },
    });

    expect(wrapper.props('duration')).toBe(500);
  });
});
