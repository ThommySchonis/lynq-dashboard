const { describe, it, expect, vi, beforeEach } = require('vitest');

const fn = vi.fn();
describe('test', () => {
  it('rejects', async () => {
    fn.mockImplementation(async () => {
      throw new Error('test');
    });
    try {
      await fn();
    } catch (e) {
      expect(e.message).toBe('test');
    }
  });
});
