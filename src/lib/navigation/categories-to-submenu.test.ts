import { categoriesToSubMenuItems } from './categories-to-submenu';

describe('categoriesToSubMenuItems', () => {
  it('sorts roots and nested submenu items by category position, leaving missing positions last', () => {
    const submenuItems = categoriesToSubMenuItems(
      [
        {
          id: 'root-b',
          position: 4,
          name: { en: 'Root B' },
          children: [
            {
              id: 'child-b2',
              position: 7,
              name: { en: 'Child B2' },
            },
            {
              id: 'child-b1',
              position: 1,
              name: { en: 'Child B1' },
            },
            {
              id: 'child-b3',
              name: { en: 'Child B3' },
            },
          ],
        },
        {
          id: 'root-a',
          position: 2,
          name: { en: 'Root A' },
        },
      ],
      'en',
    );

    expect(submenuItems.map((item) => item.id)).toEqual(['root-a', 'root-b']);
    expect(submenuItems[1].submenuItems?.map((item) => item.id)).toEqual(['child-b1', 'child-b2', 'child-b3']);
  });
});
