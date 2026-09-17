/**
 * In-DOM stand-in for `@/components/ui/select`.
 *
 * The real Radix Select portals options and runs Floating UI `autoUpdate`
 * (`requestAnimationFrame` while open). On a loaded CI runner that loop
 * keeps React `act()` from settling, so `findBy*` hangs until Jest's
 * test timeout — locally the same tests often finish in time. This mock
 * keeps options in the document and wires `onValueChange` through click.
 *
 * Use from a test file:
 *   jest.mock('@/components/ui/select', () => jest.requireActual('../../../jest/mocks/ui-select'));
 */
import React from 'react';

type SelectCtx = {
  value?: string;
  onValueChange?: (value: string) => void;
  labels: Record<string, string>;
  register: (value: string, label: string) => void;
};

const SelectContext = React.createContext<SelectCtx>({
  labels: {},
  register: () => undefined,
});

function textFromChildren(children: React.ReactNode): string {
  return React.Children.toArray(children)
    .map((child) => {
      if (typeof child === 'string' || typeof child === 'number') {
        return String(child);
      }
      if (React.isValidElement<{ children?: React.ReactNode }>(child)) {
        return textFromChildren(child.props.children);
      }
      return '';
    })
    .join('');
}

export function Select({
  children,
  onValueChange,
  value,
}: {
  children: React.ReactNode;
  onValueChange?: (value: string) => void;
  value?: string;
}) {
  const [labels, setLabels] = React.useState<Record<string, string>>({});
  const register = React.useCallback((itemValue: string, label: string) => {
    setLabels((prev) => (prev[itemValue] === label ? prev : { ...prev, [itemValue]: label }));
  }, []);

  return React.createElement(
    SelectContext.Provider,
    { value: { value, onValueChange, labels, register } },
    React.createElement('div', { 'data-slot': 'select' }, children),
  );
}

export function SelectTrigger({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return React.createElement('button', { type: 'button', role: 'combobox', ...props }, children);
}

export function SelectValue({ placeholder }: { placeholder?: string }) {
  const { value, labels } = React.useContext(SelectContext);
  const label = (value && labels[value]) || placeholder || '';
  return React.createElement('span', null, label);
}

export function SelectContent({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return React.createElement('div', { role: 'listbox', ...props }, children);
}

export function SelectItem({
  value,
  children,
  ...props
}: { value: string; children: React.ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  const { onValueChange, register } = React.useContext(SelectContext);
  const label = textFromChildren(children);

  React.useLayoutEffect(() => {
    register(value, label);
  }, [value, label, register]);

  return React.createElement(
    'div',
    {
      role: 'option',
      ...props,
      onClick: (event: React.MouseEvent<HTMLDivElement>) => {
        props.onClick?.(event);
        onValueChange?.(value);
      },
    },
    children,
  );
}

export function SelectGroup({ children }: { children: React.ReactNode }) {
  return React.createElement(React.Fragment, null, children);
}

export function SelectLabel({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return React.createElement('div', props, children);
}

export function SelectSeparator(props: React.HTMLAttributes<HTMLHRElement>) {
  return React.createElement('hr', props);
}
