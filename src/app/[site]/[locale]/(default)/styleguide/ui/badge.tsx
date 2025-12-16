import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { H4, H5 } from '@/components/ui/h';

export default function BadgeStyleGuide() {
  return (
    <div className="py-12">
      <H4 className="mb-3">Badge</H4>
      <H5 className="mb-3">Rounded</H5>
      <div className="p-4 grid grid-cols-[1fr] sm:grid-cols-[1fr_1fr] lg:grid-cols-[1fr_1fr_1fr_1fr] gap-6 mb-2">
        <div className="flex flex-wrap gap-3 flex-col items-start">
          <Badge variant="default" rounded="default">
            <ArrowRight />
            Rounded default
            <ArrowRight />
          </Badge>
        </div>
        <div className="flex flex-wrap gap-3 flex-col items-start">
          <Badge variant="default" rounded="roundedRight">
            <ArrowRight />
            Rounded right
            <ArrowRight />
          </Badge>
        </div>
        <div className="flex flex-wrap gap-3 flex-col items-start">
          <Badge variant="default" rounded="none">
            <ArrowRight />
            Rounded none
            <ArrowRight />
          </Badge>
        </div>
      </div>
      <H5 className="mb-3">Variant</H5>
      <div className="p-4 grid grid-cols-[1fr] sm:grid-cols-[1fr_1fr] lg:grid-cols-[1fr_1fr_1fr_1fr] gap-6 mb-2">
        <div className="flex flex-wrap gap-3 flex-col items-start">
          <Badge>
            <ArrowRight />
            Default badge
            <ArrowRight />
          </Badge>
        </div>
        <div className="flex flex-wrap gap-3 flex-col items-start">
          <Badge variant="secondary">
            <ArrowRight />
            Secondary badge
            <ArrowRight />
          </Badge>
        </div>
        <div className="flex flex-wrap gap-3 flex-col items-start p-3 bg-surface-neutral">
          <Badge variant="white">
            <ArrowRight />
            White badge
            <ArrowRight />
          </Badge>
        </div>
        <div className="flex flex-wrap gap-3 flex-col items-start">
          <Badge variant="black">
            <ArrowRight />
            Black badge
            <ArrowRight />
          </Badge>
        </div>
        <div className="flex flex-wrap gap-3 flex-col items-start">
          <Badge variant="success">
            <ArrowRight />
            Success badge
            <ArrowRight />
          </Badge>
        </div>
        <div className="flex flex-wrap gap-3 flex-col items-start">
          <Badge variant="warning">
            <ArrowRight />
            Warning badge
            <ArrowRight />
          </Badge>
        </div>
        <div className="flex flex-wrap gap-3 flex-col items-start">
          <Badge variant="destructive">
            <ArrowRight />
            Destructive badge
            <ArrowRight />
          </Badge>
        </div>
        <div className="flex flex-wrap gap-3 flex-col items-start">
          <Badge variant="outline">
            <ArrowRight />
            Outline badge
            <ArrowRight />
          </Badge>
        </div>
        <div className="flex flex-wrap gap-3 flex-col items-start">
          <Badge variant="information">
            <ArrowRight />
            Information badge
            <ArrowRight />
          </Badge>
        </div>
        <div className="flex flex-wrap gap-3 flex-col items-start">
          <Badge variant="info">
            <ArrowRight />
            Info badge
            <ArrowRight />
          </Badge>
        </div>
      </div>
      <H5 className="mb-3">As Link</H5>
      <div className="p-4 grid grid-cols-[1fr] sm:grid-cols-[1fr_1fr] lg:grid-cols-[1fr_1fr_1fr_1fr] gap-6 mb-2">
        <div className="flex flex-wrap gap-3 flex-col items-start">
          <Badge asChild>
            <Link href="/">
              <ArrowRight />
              Badge
              <ArrowRight />
            </Link>
          </Badge>
        </div>
        <div className="flex flex-wrap gap-3 flex-col items-start">
          <Badge variant="secondary" asChild>
            <Link href="/">
              <ArrowRight />
              Badge
              <ArrowRight />
            </Link>
          </Badge>
        </div>
        <div className="flex flex-wrap gap-3 flex-col items-start p-3 bg-surface-neutral">
          <Badge variant="white" asChild>
            <Link href="/">
              <ArrowRight />
              White badge
              <ArrowRight />
            </Link>
          </Badge>
        </div>
        <div className="flex flex-wrap gap-3 flex-col items-start">
          <Badge variant="black" asChild>
            <Link href="/">
              <ArrowRight />
              Black badge
              <ArrowRight />
            </Link>
          </Badge>
        </div>
        <div className="flex flex-wrap gap-3 flex-col items-start">
          <Badge variant="success" asChild>
            <Link href="/">
              <ArrowRight />
              Success badge
              <ArrowRight />
            </Link>
          </Badge>
        </div>
        <div className="flex flex-wrap gap-3 flex-col items-start">
          <Badge variant="warning" asChild>
            <Link href="/">
              <ArrowRight />
              Warning badge
              <ArrowRight />
            </Link>
          </Badge>
        </div>
        <div className="flex flex-wrap gap-3 flex-col items-start">
          <Badge variant="destructive" asChild>
            <Link href="/">
              <ArrowRight />
              Destructive badge
              <ArrowRight />
            </Link>
          </Badge>
        </div>
        <div className="flex flex-wrap gap-3 flex-col items-start">
          <Badge variant="outline" asChild>
            <Link href="/">
              <ArrowRight />
              Outline badge
              <ArrowRight />
            </Link>
          </Badge>
        </div>
        <div className="flex flex-wrap gap-3 flex-col items-start">
          <Badge variant="information" asChild>
            <Link href="/">
              <ArrowRight />
              Information badge
              <ArrowRight />
            </Link>
          </Badge>
        </div>
        <div className="flex flex-wrap gap-3 flex-col items-start">
          <Badge variant="info" asChild>
            <Link href="/">
              <ArrowRight />
              Info badge
              <ArrowRight />
            </Link>
          </Badge>
        </div>
      </div>
    </div>
  );
}
