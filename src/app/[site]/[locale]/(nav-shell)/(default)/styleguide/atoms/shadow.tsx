import { H4 } from '@/components/ui/h';

export default function ShadowStyleGuide() {
  return (
    <div className="py-12">
      <H4 className="mb-3">Shadows</H4>
      <div className="p-4 flex flex-wrap gap-8 mb-2">
        <div className="p-4 shadow-xs">shadow-xs</div>
        <div className="p-4 shadow-sm">shadow-sm</div>
        <div className="p-4 shadow-md">shadow-md</div>
        <div className="p-4 shadow-lg">shadow-lg</div>
        <div className="p-4 shadow-xl">shadow-xl</div>
        <div className="p-4 shadow-2xl">shadow-2xl</div>
      </div>
    </div>
  );
}
