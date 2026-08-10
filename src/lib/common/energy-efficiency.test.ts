import { isEnergyEfficiencyClass } from './energy-efficiency';

describe('isEnergyEfficiencyClass', () => {
  it.each(['A+++', 'A++', 'A+', 'A', 'B', 'G', 'a+++', '  A++  '])('returns true for energy class %s', (value) => {
    expect(isEnergyEfficiencyClass(value)).toBe(true);
  });

  it.each(['5.5 kW', 'A++++', 'AA', 'H', '', 'Energy efficiency'])('returns false for non-class value %s', (value) => {
    expect(isEnergyEfficiencyClass(value)).toBe(false);
  });
});
