'use client';

import React from 'react';
import { storyblokEditable } from '@storyblok/react/rsc';
import Button from '../button';
import ColumnTeaser from '../column-teaser';
import Hero from '../hero';
import QuickEntry from '../quick-entry';
import Recommendations from '../recommendations';

interface StoryblokComponentProps {
  blok: any;
  child: React.ReactElement;
}

/**
 * This Component is an abstraction layer to allow inclusion of regular Components into Storyblok
 * @param blok (Storyblok Data)
 * @param child (React Element to be wrapped)
 * @returns
 */

const StoryblokComponent = ({ blok, child }: StoryblokComponentProps) => {
  return <div {...storyblokEditable(blok)}>{React.cloneElement(child, { ...blok })}</div>;
};

export const StoryblokHero = ({ blok }: any) => {
  return <StoryblokComponent blok={blok} child={<Hero {...blok} />} />;
};

export const StoryblokButton = ({ blok }: any) => {
  return <StoryblokComponent blok={blok} child={<Button {...blok} />} />;
};

export const StoryblokQuickEntry = ({ blok }: any) => {
  return <StoryblokComponent blok={blok} child={<QuickEntry {...blok} />} />;
};

export const StoryblokColumnTeaser = ({ blok }: any) => {
  return <StoryblokComponent blok={blok} child={<ColumnTeaser {...blok} />} />;
};

export const StoryblokRecommendations = ({ blok }: any) => {
  return <StoryblokComponent blok={blok} child={<Recommendations {...blok} />} />;
};

export default StoryblokComponent;
