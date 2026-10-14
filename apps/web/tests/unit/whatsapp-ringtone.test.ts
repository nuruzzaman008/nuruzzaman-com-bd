import { afterEach, expect, it, vi } from 'vitest';
import { startRingtone } from '@/features/whatsapp/call-audio';
afterEach(() => vi.useRealTimers());
it('plays a gentle six-note chime repeatedly and cancels every tone when stopped', () => {
  vi.useFakeTimers();
  const nodes: {
    start: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
    frequency: { value: number };
  }[] = [];
  const context = {
    state: 'running',
    currentTime: 10,
    destination: {},
    createGain: () => ({
      gain: {
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
      disconnect: vi.fn(),
    }),
    createOscillator: () => {
      const node = {
        frequency: { value: 0 },
        type: '',
        connect: vi.fn(),
        disconnect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
        onended: null,
      };
      nodes.push(node);
      return node;
    },
  };
  const stop = startRingtone(context as unknown as AudioContext);
  expect(nodes.map((node) => node.frequency.value)).toEqual([
    587.33, 739.99, 880, 1174.66, 880, 739.99,
  ]);
  expect(nodes[0].start).toHaveBeenCalledWith(10);
  expect(nodes[5].start).toHaveBeenCalledWith(11.1);
  vi.advanceTimersByTime(4200);
  expect(nodes).toHaveLength(12);
  stop();
  expect(nodes.every((node) => node.stop.mock.calls.some((call) => call.length === 0))).toBe(true);
  vi.advanceTimersByTime(20000);
  expect(nodes).toHaveLength(12);
});
it('does not play sound when the browser has suspended audio', () => {
  const createOscillator = vi.fn();
  const stop = startRingtone({ state: 'suspended', createOscillator } as unknown as AudioContext);
  expect(createOscillator).not.toHaveBeenCalled();
  stop();
});
