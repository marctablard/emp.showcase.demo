async function loadModule() {
  jest.resetModules();

  const services = new Map<string, unknown>();

  jest.doMock('@/platform/ssr', () => ({
    __esModule: true,
    default: {
      get: jest.fn((id: string) => services.get(id)),
    },
  }));

  const { getCategoryAncestorTrail } = await import('./category-ancestor-trail');

  return {
    getCategoryAncestorTrail,
    services,
  };
}

describe('getCategoryAncestorTrail', () => {
  it('returns root-to-leaf trail with leaf appended after multi-level parents', async () => {
    const { getCategoryAncestorTrail, services } = await loadModule();

    const getCategoryParents = jest.fn().mockResolvedValue([
      { id: 'root', name: { en: 'Root' } },
      { id: 'level-1', name: { en: 'Level 1' } },
      { id: 'level-2', name: { en: 'Level 2' } },
    ]);
    const getCategoryById = jest.fn().mockResolvedValue({ id: 'leaf', name: { en: 'Leaf' } });

    services.set('CategoryService', {
      getCategoryParents,
      getCategoryById,
    });

    await expect(getCategoryAncestorTrail('leaf')).resolves.toEqual([
      { id: 'root', name: { en: 'Root' } },
      { id: 'level-1', name: { en: 'Level 1' } },
      { id: 'level-2', name: { en: 'Level 2' } },
      { id: 'leaf', name: { en: 'Leaf' } },
    ]);

    expect(getCategoryParents).toHaveBeenCalledWith('leaf');
    expect(getCategoryById).toHaveBeenCalledWith('leaf');
  });

  it('uses the provided leaf category and avoids an additional leaf lookup', async () => {
    const { getCategoryAncestorTrail, services } = await loadModule();

    const getCategoryParents = jest.fn().mockResolvedValue([{ id: 'root', name: { en: 'Root' } }]);
    const getCategoryById = jest.fn();
    const providedLeaf = { id: 'leaf', name: { en: 'Leaf from product payload' } };

    services.set('CategoryService', {
      getCategoryParents,
      getCategoryById,
    });

    await expect(getCategoryAncestorTrail('leaf', providedLeaf)).resolves.toEqual([
      { id: 'root', name: { en: 'Root' } },
      { id: 'leaf', name: { en: 'Leaf from product payload' } },
    ]);

    expect(getCategoryById).not.toHaveBeenCalled();
  });

  it('returns empty when parent categories are unavailable', async () => {
    const { getCategoryAncestorTrail, services } = await loadModule();

    const getCategoryParents = jest.fn().mockResolvedValue([]);
    const getCategoryById = jest.fn();

    services.set('CategoryService', {
      getCategoryParents,
      getCategoryById,
    });

    await expect(getCategoryAncestorTrail('leaf')).resolves.toEqual([]);
    expect(getCategoryById).not.toHaveBeenCalled();
  });

  it('returns empty when category service fails', async () => {
    const { getCategoryAncestorTrail, services } = await loadModule();

    services.set('CategoryService', {
      getCategoryParents: jest.fn().mockRejectedValue(new Error('emporix unavailable')),
      getCategoryById: jest.fn(),
    });

    await expect(getCategoryAncestorTrail('leaf')).resolves.toEqual([]);
  });
});
