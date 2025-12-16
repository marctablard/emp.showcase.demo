import { routing as siteRouting } from '@/site/routing'
import { routing } from '../routing'
import { createNavigation as createIntlNavigation } from 'next-intl/navigation';
import createNavigation from '@/site/navigation/edge/createNavigation';

export const { getPathname: getI18nPathname } = createIntlNavigation(routing);
export const { Link, redirect, getPathname } = createNavigation(siteRouting, routing);