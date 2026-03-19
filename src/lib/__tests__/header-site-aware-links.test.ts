import fs from 'fs';
import path from 'path';

const HEADER_MENU_FILES = [
  'src/components/header/desktop/menu-level-1.tsx',
  'src/components/header/desktop/menu-flyout.tsx',
  'src/components/header/mobile/menu-navigation.tsx',
  'src/components/header/tablet/menu-flyout.tsx',
] as const;

describe('header menu links', () => {
  test.each(HEADER_MENU_FILES)('%s uses site-aware navigation Link', (relativePath) => {
    const absolutePath = path.join(process.cwd(), relativePath);
    const source = fs.readFileSync(absolutePath, 'utf8');

    expect(source).toContain("import { Link } from '@/i18n/navigation'");
    expect(source).not.toContain("import Link from 'next/link'");
  });
});
