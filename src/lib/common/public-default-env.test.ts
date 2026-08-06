import {
  PUBLIC_PDP_DESCRIPTION_CLAMP_CLASS_BY_LINES,
  getPublicDefaultPostalCode,
  getPublicPdpDescriptionClampClass,
  getPublicPdpDescriptionClampLines,
} from './public-default-env';

describe('getPublicDefaultPostalCode', () => {
  const original = process.env.NEXT_PUBLIC_DEFAULT_POSTAL_CODE;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.NEXT_PUBLIC_DEFAULT_POSTAL_CODE;
    } else {
      process.env.NEXT_PUBLIC_DEFAULT_POSTAL_CODE = original;
    }
  });

  it('returns the Berlin fallback 10115 when the env variable is unset', () => {
    delete process.env.NEXT_PUBLIC_DEFAULT_POSTAL_CODE;

    expect(getPublicDefaultPostalCode()).toBe('10115');
  });

  it('returns the configured value when the env variable is set', () => {
    process.env.NEXT_PUBLIC_DEFAULT_POSTAL_CODE = '80331';

    expect(getPublicDefaultPostalCode()).toBe('80331');
  });

  it('returns the fallback when the env variable is blank', () => {
    process.env.NEXT_PUBLIC_DEFAULT_POSTAL_CODE = '   ';

    expect(getPublicDefaultPostalCode()).toBe('10115');
  });
});

describe('getPublicPdpDescriptionClampLines', () => {
  const original = process.env.NEXT_PUBLIC_PDP_DESCRIPTION_CLAMP_LINES;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.NEXT_PUBLIC_PDP_DESCRIPTION_CLAMP_LINES;
    } else {
      process.env.NEXT_PUBLIC_PDP_DESCRIPTION_CLAMP_LINES = original;
    }
  });

  it('returns the Figma fallback of 2 when the env variable is unset', () => {
    delete process.env.NEXT_PUBLIC_PDP_DESCRIPTION_CLAMP_LINES;

    expect(getPublicPdpDescriptionClampLines()).toBe(2);
  });

  it('returns the configured positive integer when the env variable is valid', () => {
    process.env.NEXT_PUBLIC_PDP_DESCRIPTION_CLAMP_LINES = '3';

    expect(getPublicPdpDescriptionClampLines()).toBe(3);
  });

  it('returns the fallback when the env variable is non-numeric', () => {
    process.env.NEXT_PUBLIC_PDP_DESCRIPTION_CLAMP_LINES = 'invalid';

    expect(getPublicPdpDescriptionClampLines()).toBe(2);
  });

  it('returns the fallback when the env variable is zero', () => {
    process.env.NEXT_PUBLIC_PDP_DESCRIPTION_CLAMP_LINES = '0';

    expect(getPublicPdpDescriptionClampLines()).toBe(2);
  });

  it('returns the fallback when the env variable is negative', () => {
    process.env.NEXT_PUBLIC_PDP_DESCRIPTION_CLAMP_LINES = '-1';

    expect(getPublicPdpDescriptionClampLines()).toBe(2);
  });
});

describe('getPublicPdpDescriptionClampClass', () => {
  it('maps every supported line count to a complete line-clamp-* literal', () => {
    expect(PUBLIC_PDP_DESCRIPTION_CLAMP_CLASS_BY_LINES).toEqual({
      1: 'line-clamp-1',
      2: 'line-clamp-2',
      3: 'line-clamp-3',
      4: 'line-clamp-4',
      5: 'line-clamp-5',
      6: 'line-clamp-6',
    });

    expect(getPublicPdpDescriptionClampClass(2)).toBe('line-clamp-2');
    expect(getPublicPdpDescriptionClampClass(6)).toBe('line-clamp-6');
  });

  it('returns the fallback class when the line count is out of range', () => {
    expect(getPublicPdpDescriptionClampClass(0)).toBe('line-clamp-2');
    expect(getPublicPdpDescriptionClampClass(7)).toBe('line-clamp-2');
    expect(getPublicPdpDescriptionClampClass(99)).toBe('line-clamp-2');
  });
});
