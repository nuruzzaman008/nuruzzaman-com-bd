import { describe, expect, it } from 'vitest';

import { clientAddress } from '@/lib/client-address';

describe('the address passed on to the API', () => {
  it('is the one our own web server appended, not the one a visitor wrote', () => {
    // A visitor sends "203.0.113.7"; the web server in front appends what it saw.
    expect(clientAddress('203.0.113.7, 103.231.34.92')).toBe('103.231.34.92');
    expect(clientAddress('1.1.1.1,2.2.2.2 , 103.231.34.92')).toBe('103.231.34.92');
  });

  it('is the only entry when there is only one, and nothing when there is none', () => {
    expect(clientAddress('103.231.34.92')).toBe('103.231.34.92');
    expect(clientAddress('')).toBe('');
    expect(clientAddress(null)).toBe('');
    expect(clientAddress(' , ')).toBe('');
  });
});
