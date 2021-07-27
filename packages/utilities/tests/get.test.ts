import { get } from '../src/index';

test('GIVEN get() THEN proper data', () => {
	expect(get({ a: 'b' }, '')).toEqual({ a: 'b' });
	expect(get({ a: 'b' }, 'a')).toBe('b');
	expect(get({ a: 'b' }, '[a]')).toBe('b');
	expect(get({ a: { b: 'c' } }, 'a.b')).toBe('c');
	expect(get({ a: { b: 'c' } }, 'a[b]')).toBe('c');
	expect(get({ a: { b: { c: ['d'] } } }, 'a.b.c')).toEqual(['d']);
	expect(get({ a: { b: { c: ['d'] } } }, 'a.b.c[0]')).toBe('d');
	expect(get({ a: { b: { c: ['d', ['e']] } } }, 'a.b.c[1]')).toEqual(['e']);
	expect(get({ a: { b: { c: ['d', ['e']] } } }, 'a.b.c[1][0]')).toBe('e');
	expect(get([{ a: 'b' }], '[0].a')).toBe('b');
	expect(get(['a', { b: 'c' }], '[1].b')).toBe('c');
	expect(get(['a', { b: { c: ['d'] } }], '[1].b.c')).toEqual(['d']);
});
