import { act, renderHook } from '@testing-library/react';
import { usePersistedState } from './usePersistedState';

describe('usePersistedState', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('should initialize with default value when no stored value', () => {
    const { result } = renderHook(() => usePersistedState({ key: 'test', defaultValue: 'default' }));
    expect(result.current[0]).toBe('default');
  });

  it('should initialize with stored value', () => {
    localStorage.setItem('test', '"stored"');

    const { result } = renderHook(() => usePersistedState({ key: 'test', defaultValue: 'default' }));
    expect(result.current[0]).toBe('stored');
  });

  it('should persist value to localStorage', () => {
    const { result } = renderHook(() => usePersistedState({ key: 'test', defaultValue: 'default' }));

    act(() => {
      result.current[1]('new value');
    });

    expect(localStorage.getItem('test')).toBe('"new value"');
  });

  it('should persist value to sessionStorage when specified', () => {
    const { result } = renderHook(() =>
      usePersistedState({ key: 'test', defaultValue: 'default', storage: 'sessionStorage' }),
    );

    act(() => {
      result.current[1]('new value');
    });

    expect(sessionStorage.getItem('test')).toBe('"new value"');
    expect(localStorage.getItem('test')).toBeNull();
  });

  it('should update state with setter function', () => {
    const { result } = renderHook(() => usePersistedState({ key: 'test', defaultValue: 0 }));

    act(() => {
      result.current[1]((prev) => prev + 1);
    });

    expect(result.current[0]).toBe(1);
  });

  it('should clear value and reset to default', () => {
    localStorage.setItem('test', '"stored"');

    const { result } = renderHook(() => usePersistedState({ key: 'test', defaultValue: 'default' }));

    expect(result.current[0]).toBe('stored');

    act(() => {
      result.current[2](); // clear
    });

    // State should be reset to default
    expect(result.current[0]).toBe('default');
  });

  it('should handle complex objects', () => {
    const defaultValue: { items: string[]; count: number } = { items: [], count: 0 };
    const { result } = renderHook(() => usePersistedState({ key: 'test', defaultValue }));

    act(() => {
      result.current[1]({ items: ['a', 'b'], count: 2 });
    });

    expect(result.current[0]).toEqual({ items: ['a', 'b'], count: 2 });
    expect(localStorage.getItem('test')).toBe('{"items":["a","b"],"count":2}');
  });

  it('should handle custom serializer/deserializer', () => {
    const serialize = (value: Date) => value.toISOString();
    const deserialize = (value: string) => new Date(value);

    const defaultValue = new Date('2024-01-01');
    const { result } = renderHook(() =>
      usePersistedState({
        key: 'test',
        defaultValue,
        serialize,
        deserialize,
      }),
    );

    const newDate = new Date('2024-06-15');
    act(() => {
      result.current[1](newDate);
    });

    expect(result.current[0].toISOString()).toBe(newDate.toISOString());
  });

  it('should handle invalid JSON in storage gracefully', () => {
    localStorage.setItem('test', 'invalid json{');

    const { result } = renderHook(() => usePersistedState({ key: 'test', defaultValue: 'default' }));
    expect(result.current[0]).toBe('default');
  });

  it('should handle arrays', () => {
    const { result } = renderHook(() => usePersistedState<string[]>({ key: 'test', defaultValue: [] }));

    act(() => {
      result.current[1](['a', 'b', 'c']);
    });

    expect(result.current[0]).toEqual(['a', 'b', 'c']);
  });

  it('should handle boolean values', () => {
    const { result } = renderHook(() => usePersistedState({ key: 'test', defaultValue: false }));

    act(() => {
      result.current[1](true);
    });

    expect(result.current[0]).toBe(true);
    expect(localStorage.getItem('test')).toBe('true');
  });
});
