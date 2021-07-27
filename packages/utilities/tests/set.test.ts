import { set } from '../src/index';

test('GIVEN set() THEN proper data', () => {
	expect(set({}, 'a', 'b')).toEqual({ a: 'b' });
	expect(set({}, '[a]', 'b')).toEqual({ a: 'b' });
	expect(set({}, '[0]', 'a')).toEqual({ 0: 'a' });
	expect(set({ a: 'b' }, 'a.b', 'c')).toEqual({ a: { b: 'c' } });
	expect(set({ a: ['b'] }, 'a', 'b')).toEqual({ a: 'b' });
	expect(set([], '0', 'a')).toEqual(['a']);
	expect(set(['a'], '0', { a: 'b' })).toEqual([{ a: 'b' }]);
});
