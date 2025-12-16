import React, { useState } from 'react';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Checkbox } from './checkbox';

type RatingContextProps = {
  starsCount?: number;
  disabled?: boolean;
  className?: string;
};

type StarRowProps = {
  starsCount?: number;
  filledCount?: number;
  disabled?: boolean;
  className?: string;
  checkbox?: boolean;
};

type StarProps = {
  filled?: boolean;
  className?: string;
};

function Rating({ className, starsCount, disabled, ...props }: React.ComponentProps<'div'> & RatingContextProps) {
  const rowsCount = starsCount ? starsCount + 1 : 0;
  return (
    <div
      data-slot="rating"
      className={cn('inline-flex flex-col gap-4', className)}
      style={{ width: 'fit-content' }}
      {...props}
    >
      {[...Array(rowsCount).keys()].map((item, i) => {
        return <RatingStarRow starsCount={starsCount} filledCount={item} key={'starRow-' + i} disabled={disabled} />;
      })}
    </div>
  );
}

function RatingStarRow({
  className,
  starsCount,
  filledCount,
  checkbox,
  disabled,
  ...props
}: React.ComponentProps<'div'> & StarRowProps) {
  let filled = false;
  const [checked, setChecked] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isStarsHovered, setIsStarsHovered] = useState(false);

  const handleClick = () => {
    if (!disabled) {
      setChecked(!checked);
    }
  };

  // Combined hover state - either the whole row or just the stars
  const combinedHoverState = isHovered || isStarsHovered;

  return (
    <div
      data-slot="rating"
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={cn(
        'flex items-center gap-3 cursor-pointer',
        'text-icon-secondary',
        combinedHoverState && !disabled && 'text-picon-action-hover',
        checked && !disabled && 'text-icon-action-hover',
        disabled && 'cursor-not-allowed text-text-disabled disabled:pointer-events-none hover:text-text-disabled',
        className,
      )}
      {...props}
    >
      {checkbox && (
        <Checkbox
          checked={checked}
          disabled={disabled}
          className={cn(
            combinedHoverState && !disabled && 'text-icon-action-hover',
            checked && !disabled && 'text-icon-action-hover',
          )}
          onCheckedChange={() => setChecked(!checked)}
        />
      )}
      <div
        tabIndex={0}
        className={cn(
          'flex items-center gap-1',
          'transition duration-150 ease-in-out',
          'focus:outline-2 focus:outline-offset-2 focus:outline-border-focus focus:rounded focus:text-text-action',
          (combinedHoverState || checked) && !disabled && 'text-text-action-hover',
        )}
        onMouseEnter={() => setIsStarsHovered(true)}
        onMouseLeave={() => setIsStarsHovered(false)}
      >
        {[...Array(starsCount).keys()].map((item, i) => {
          filled = filledCount ? filledCount - item > 0 : false;
          return <RatingStar filled={filled} key={'star-' + i}></RatingStar>;
        })}
      </div>
    </div>
  );
}

function RatingStar({ className, filled }: React.ComponentProps<'div'> & StarProps) {
  return <Star className={cn('w-6 h-6', filled && 'fill-current', className)} />;
}

export { Rating, RatingStar, RatingStarRow };
