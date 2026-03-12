import React from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ComponentNode {
  type: string;
  id?: string;
  action?: string;
  children?: ComponentNode[];
  [key: string]: unknown;
}

export interface DynamicRendererProps {
  node: ComponentNode;
  onAction?: (action: string, data?: Record<string, unknown>) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

function renderChildren(
  children: ComponentNode[] | undefined,
  onAction?: DynamicRendererProps['onAction'],
) {
  if (!children || children.length === 0) return null;
  return children.map((child, i) => (
    <DynamicRenderer key={child.id ?? i} node={child} onAction={onAction} />
  ));
}

// Gap helper -- converts a number gap prop to a Tailwind gap class
function gapClass(gap?: unknown): string {
  if (gap === undefined || gap === null) return 'gap-4';
  const n = Number(gap);
  if (Number.isNaN(n)) return 'gap-4';
  return `gap-${n}`;
}

// ---------------------------------------------------------------------------
// Layout components
// ---------------------------------------------------------------------------

function ColumnComponent({ node, onAction }: DynamicRendererProps) {
  return (
    <div className={cn('flex flex-col', gapClass(node.gap))}>
      {renderChildren(node.children, onAction)}
    </div>
  );
}

function RowComponent({ node, onAction }: DynamicRendererProps) {
  const alignMap: Record<string, string> = {
    start: 'items-start',
    center: 'items-center',
    end: 'items-end',
    stretch: 'items-stretch',
    baseline: 'items-baseline',
  };
  const align = alignMap[node.align as string] ?? 'items-center';
  return (
    <div className={cn('flex flex-row flex-wrap', align, gapClass(node.gap))}>
      {renderChildren(node.children, onAction)}
    </div>
  );
}

function GridComponent({ node, onAction }: DynamicRendererProps) {
  const cols = Number(node.columns) || 2;
  return (
    <div
      className={cn('grid', gapClass(node.gap))}
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
    >
      {renderChildren(node.children, onAction)}
    </div>
  );
}

function CardComponent({ node, onAction }: DynamicRendererProps) {
  return (
    <div className="border border-[#DDDDDD] rounded-xl shadow-sm p-4 bg-white">
      {node.title ? (
        <h3 className="text-lg font-semibold text-[#222222] mb-1">
          {String(node.title)}
        </h3>
      ) : null}
      {node.description ? (
        <p className="text-sm text-[#717171] mb-3">
          {String(node.description)}
        </p>
      ) : null}
      {renderChildren(node.children, onAction)}
    </div>
  );
}

function TabsComponent({ node, onAction }: DynamicRendererProps) {
  const panels = (node.children ?? []).filter((c) => c.type === 'TabPanel');
  const [activeIndex, setActiveIndex] = React.useState(0);

  return (
    <div>
      {/* Tab headers */}
      <div className="flex border-b border-[#DDDDDD] mb-3">
        {panels.map((panel, i) => {
          const label = (panel.label as string) ?? `Tab ${i + 1}`;
          const active = i === activeIndex;
          return (
            <button
              key={panel.id ?? i}
              onClick={() => setActiveIndex(i)}
              className={cn(
                'px-4 py-2 text-sm font-medium transition-colors -mb-px',
                active
                  ? 'border-b-2 border-[#FF5A5F] text-[#FF5A5F]'
                  : 'text-[#717171] hover:text-[#222222]',
              )}
            >
              {label}
            </button>
          );
        })}
      </div>
      {/* Active panel */}
      {panels[activeIndex] && (
        <div>{renderChildren(panels[activeIndex].children, onAction)}</div>
      )}
    </div>
  );
}

function TabPanelComponent({ node, onAction }: DynamicRendererProps) {
  // TabPanel rendered standalone (outside Tabs) just renders children
  return <div>{renderChildren(node.children, onAction)}</div>;
}

function AccordionComponent({ node, onAction }: DynamicRendererProps) {
  const items = (node.children ?? []).filter(
    (c) => c.type === 'AccordionItem',
  );
  const [openSet, setOpenSet] = React.useState<Set<number>>(new Set());

  const toggle = (idx: number) => {
    setOpenSet((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  return (
    <div className="divide-y divide-[#DDDDDD] border border-[#DDDDDD] rounded-xl overflow-hidden">
      {items.map((item, i) => {
        const isOpen = openSet.has(i);
        const title = (item.title as string) ?? `Section ${i + 1}`;
        return (
          <div key={item.id ?? i}>
            <button
              onClick={() => toggle(i)}
              className="w-full flex items-center justify-between px-4 py-3 text-left text-sm font-medium text-[#222222] hover:bg-[#F7F7F7] transition-colors"
            >
              <span>{title}</span>
              <span
                className={cn(
                  'transition-transform text-[#717171]',
                  isOpen && 'rotate-180',
                )}
              >
                &#9662;
              </span>
            </button>
            {isOpen && (
              <div className="px-4 pb-3 text-sm text-[#222222]">
                {renderChildren(item.children, onAction)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function AccordionItemComponent({ node, onAction }: DynamicRendererProps) {
  // Standalone render (outside Accordion)
  const [open, setOpen] = React.useState(false);
  const title = (node.title as string) ?? 'Section';
  return (
    <div className="border border-[#DDDDDD] rounded-xl overflow-hidden mb-2">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 text-left text-sm font-medium text-[#222222] hover:bg-[#F7F7F7]"
      >
        <span>{title}</span>
        <span className={cn('transition-transform text-[#717171]', open && 'rotate-180')}>
          &#9662;
        </span>
      </button>
      {open && (
        <div className="px-4 pb-3 text-sm">{renderChildren(node.children, onAction)}</div>
      )}
    </div>
  );
}

function SeparatorComponent() {
  return <hr className="border-[#DDDDDD] my-3" />;
}

// ---------------------------------------------------------------------------
// Input components
// ---------------------------------------------------------------------------

function ButtonComponent({ node, onAction }: DynamicRendererProps) {
  const variant = (node.variant as string) ?? 'default';
  const base =
    'inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50';

  const variants: Record<string, string> = {
    default: 'bg-[#FF5A5F] text-white hover:bg-[#E04850] focus:ring-[#FF5A5F]',
    outline:
      'border border-[#DDDDDD] bg-white text-[#222222] hover:bg-[#F7F7F7] focus:ring-[#FF5A5F]',
    secondary: 'bg-[#F7F7F7] text-[#222222] hover:bg-[#EBEBEB] focus:ring-[#FF5A5F]',
    ghost: 'text-[#222222] hover:bg-[#F7F7F7] focus:ring-[#FF5A5F]',
    destructive: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-600',
  };

  return (
    <button
      className={cn(base, variants[variant] ?? variants.default)}
      disabled={!!node.disabled}
      onClick={() => {
        if (node.action && onAction) {
          onAction(node.action as string, { id: node.id });
        }
      }}
    >
      {(node.label as string) ?? (node.content as string) ?? 'Button'}
    </button>
  );
}

function InputComponent({ node, onAction }: DynamicRendererProps) {
  const [value, setValue] = React.useState((node.defaultValue as string) ?? '');
  const label = node.label as string | undefined;
  const placeholder = (node.placeholder as string) ?? '';

  const fireAction = (val: string) => {
    if (node.action && onAction) {
      onAction(node.action as string, { id: node.id, value: val });
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-sm font-medium text-[#222222]">{label}</label>
      )}
      <input
        type={(node.inputType as string) ?? 'text'}
        className="border border-[#DDDDDD] rounded-lg px-3 py-2 text-sm text-[#222222] placeholder:text-[#717171] focus:outline-none focus:ring-2 focus:ring-[#FF5A5F] focus:border-transparent"
        placeholder={placeholder}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => fireAction(value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') fireAction(value);
        }}
      />
    </div>
  );
}

function TextareaComponent({ node, onAction }: DynamicRendererProps) {
  const [value, setValue] = React.useState((node.defaultValue as string) ?? '');
  const label = node.label as string | undefined;

  const fireAction = (val: string) => {
    if (node.action && onAction) {
      onAction(node.action as string, { id: node.id, value: val });
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-sm font-medium text-[#222222]">{label}</label>
      )}
      <textarea
        className="border border-[#DDDDDD] rounded-lg px-3 py-2 text-sm text-[#222222] placeholder:text-[#717171] focus:outline-none focus:ring-2 focus:ring-[#FF5A5F] focus:border-transparent min-h-[80px] resize-y"
        placeholder={(node.placeholder as string) ?? ''}
        value={value}
        rows={Number(node.rows) || 3}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => fireAction(value)}
      />
    </div>
  );
}

function SelectComponent({ node, onAction }: DynamicRendererProps) {
  const options = (node.options as Array<{ label: string; value: string }>) ?? [];
  const [value, setValue] = React.useState(
    (node.defaultValue as string) ?? (options[0]?.value ?? ''),
  );
  const label = node.label as string | undefined;
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  // Close on outside click
  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selectedLabel = options.find((o) => o.value === value)?.label ?? value;

  return (
    <div className="flex flex-col gap-1.5" ref={ref}>
      {label && (
        <label className="text-sm font-medium text-[#222222]">{label}</label>
      )}
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="w-full flex items-center justify-between border border-[#DDDDDD] rounded-lg px-3 py-2 text-sm text-[#222222] bg-white hover:bg-[#F7F7F7] focus:outline-none focus:ring-2 focus:ring-[#FF5A5F]"
        >
          <span>{selectedLabel || 'Select...'}</span>
          <span className="text-[#717171]">&#9662;</span>
        </button>
        {open && (
          <div className="absolute z-50 mt-1 w-full bg-white border border-[#DDDDDD] rounded-lg shadow-lg max-h-60 overflow-y-auto">
            {options.map((opt) => (
              <button
                key={opt.value}
                onClick={() => {
                  setValue(opt.value);
                  setOpen(false);
                  if (node.action && onAction) {
                    onAction(node.action as string, { id: node.id, value: opt.value });
                  }
                }}
                className={cn(
                  'w-full text-left px-3 py-2 text-sm hover:bg-[#F7F7F7] transition-colors',
                  opt.value === value
                    ? 'text-[#FF5A5F] font-medium'
                    : 'text-[#222222]',
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CheckboxComponent({ node, onAction }: DynamicRendererProps) {
  const [checked, setChecked] = React.useState(!!node.defaultChecked);
  const label = (node.label as string) ?? '';

  return (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      <span
        role="checkbox"
        aria-checked={checked}
        tabIndex={0}
        onClick={() => {
          const next = !checked;
          setChecked(next);
          if (node.action && onAction) {
            onAction(node.action as string, { id: node.id, value: next });
          }
        }}
        onKeyDown={(e) => {
          if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            const next = !checked;
            setChecked(next);
            if (node.action && onAction) {
              onAction(node.action as string, { id: node.id, value: next });
            }
          }
        }}
        className={cn(
          'w-5 h-5 rounded border-2 flex items-center justify-center transition-colors',
          checked
            ? 'bg-[#FF5A5F] border-[#FF5A5F] text-white'
            : 'border-[#DDDDDD] bg-white',
        )}
      >
        {checked && (
          <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none">
            <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
      {label && <span className="text-sm text-[#222222]">{label}</span>}
    </label>
  );
}

function RadioGroupComponent({ node, onAction }: DynamicRendererProps) {
  const options = (node.options as Array<{ label: string; value: string }>) ?? [];
  const [value, setValue] = React.useState(
    (node.defaultValue as string) ?? (options[0]?.value ?? ''),
  );
  const label = node.label as string | undefined;

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-sm font-medium text-[#222222]">{label}</label>
      )}
      <div className="flex flex-col gap-2">
        {options.map((opt) => (
          <label
            key={opt.value}
            className="flex items-center gap-2 cursor-pointer select-none"
          >
            <span
              role="radio"
              aria-checked={opt.value === value}
              tabIndex={0}
              onClick={() => {
                setValue(opt.value);
                if (node.action && onAction) {
                  onAction(node.action as string, { id: node.id, value: opt.value });
                }
              }}
              onKeyDown={(e) => {
                if (e.key === ' ' || e.key === 'Enter') {
                  e.preventDefault();
                  setValue(opt.value);
                  if (node.action && onAction) {
                    onAction(node.action as string, { id: node.id, value: opt.value });
                  }
                }
              }}
              className={cn(
                'w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors',
                opt.value === value
                  ? 'border-[#FF5A5F]'
                  : 'border-[#DDDDDD]',
              )}
            >
              {opt.value === value && (
                <span className="w-2.5 h-2.5 rounded-full bg-[#FF5A5F]" />
              )}
            </span>
            <span className="text-sm text-[#222222]">{opt.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

function SliderComponent({ node, onAction }: DynamicRendererProps) {
  const min = Number(node.min) || 0;
  const max = Number(node.max) || 100;
  const step = Number(node.step) || 1;
  const defaultVal = Number(node.defaultValue ?? node.default) || min;
  const [value, setValue] = React.useState(defaultVal);
  const label = node.label as string | undefined;

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-[#222222]">{label}</label>
          <span className="text-sm text-[#717171]">{value}</span>
        </div>
      )}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => {
          const v = Number(e.target.value);
          setValue(v);
        }}
        onMouseUp={() => {
          if (node.action && onAction) {
            onAction(node.action as string, { id: node.id, value });
          }
        }}
        onTouchEnd={() => {
          if (node.action && onAction) {
            onAction(node.action as string, { id: node.id, value });
          }
        }}
        className="w-full h-2 rounded-full appearance-none bg-[#DDDDDD] accent-[#FF5A5F] cursor-pointer"
      />
      {!label && (
        <div className="flex justify-between text-xs text-[#717171]">
          <span>{min}</span>
          <span>{max}</span>
        </div>
      )}
    </div>
  );
}

function CalendarComponent({ node, onAction }: DynamicRendererProps) {
  const today = new Date();
  const [viewYear, setViewYear] = React.useState(today.getFullYear());
  const [viewMonth, setViewMonth] = React.useState(today.getMonth());
  const [selected, setSelected] = React.useState<string | null>(
    (node.defaultValue as string) ?? null,
  );

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  const dayNames = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1); }
    else setViewMonth(viewMonth - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1); }
    else setViewMonth(viewMonth + 1);
  };

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDayOfWeek; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const isToday = (d: number) =>
    d === today.getDate() && viewMonth === today.getMonth() && viewYear === today.getFullYear();

  const dateStr = (d: number) =>
    `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

  return (
    <div className="border border-[#DDDDDD] rounded-xl p-3 w-fit bg-white">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <button onClick={prevMonth} className="p-1 hover:bg-[#F7F7F7] rounded-lg text-[#717171]">
          &#8249;
        </button>
        <span className="text-sm font-medium text-[#222222]">
          {monthNames[viewMonth]} {viewYear}
        </span>
        <button onClick={nextMonth} className="p-1 hover:bg-[#F7F7F7] rounded-lg text-[#717171]">
          &#8250;
        </button>
      </div>
      {/* Day headers */}
      <div className="grid grid-cols-7 gap-0">
        {dayNames.map((d) => (
          <div key={d} className="text-center text-xs font-medium text-[#717171] py-1 w-9">
            {d}
          </div>
        ))}
        {cells.map((day, i) => (
          <div key={i} className="flex items-center justify-center w-9 h-9">
            {day !== null ? (
              <button
                onClick={() => {
                  const ds = dateStr(day);
                  setSelected(ds);
                  if (node.action && onAction) {
                    onAction(node.action as string, { id: node.id, value: ds });
                  }
                }}
                className={cn(
                  'w-8 h-8 rounded-full text-sm transition-colors',
                  selected === dateStr(day)
                    ? 'bg-[#FF5A5F] text-white font-medium'
                    : isToday(day)
                      ? 'bg-[#F7F7F7] text-[#222222] font-medium'
                      : 'text-[#222222] hover:bg-[#F7F7F7]',
                )}
              >
                {day}
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function SwitchComponent({ node, onAction }: DynamicRendererProps) {
  const [on, setOn] = React.useState(!!node.defaultChecked);
  const label = (node.label as string) ?? '';

  return (
    <label className="flex items-center gap-3 cursor-pointer select-none">
      <button
        role="switch"
        aria-checked={on}
        onClick={() => {
          const next = !on;
          setOn(next);
          if (node.action && onAction) {
            onAction(node.action as string, { id: node.id, value: next });
          }
        }}
        className={cn(
          'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#FF5A5F] focus:ring-offset-2',
          on ? 'bg-[#FF5A5F]' : 'bg-[#DDDDDD]',
        )}
      >
        <span
          className={cn(
            'inline-block h-4 w-4 rounded-full bg-white shadow transition-transform',
            on ? 'translate-x-6' : 'translate-x-1',
          )}
        />
      </button>
      {label && <span className="text-sm text-[#222222]">{label}</span>}
    </label>
  );
}

// ---------------------------------------------------------------------------
// Display components
// ---------------------------------------------------------------------------

function TextComponent({ node }: DynamicRendererProps) {
  const variant = (node.variant as string) ?? 'p';
  const content = (node.content as string) ?? '';

  const variantStyles: Record<string, string> = {
    h1: 'text-3xl font-bold text-[#222222]',
    h2: 'text-2xl font-semibold text-[#222222]',
    h3: 'text-xl font-semibold text-[#222222]',
    h4: 'text-lg font-medium text-[#222222]',
    p: 'text-base text-[#222222]',
    small: 'text-sm text-[#222222]',
    muted: 'text-sm text-[#717171]',
  };

  const tagMap: Record<string, keyof React.JSX.IntrinsicElements> = {
    h1: 'h1',
    h2: 'h2',
    h3: 'h3',
    h4: 'h4',
    p: 'p',
    small: 'small',
    muted: 'p',
  };

  const Tag = tagMap[variant] ?? 'p';
  return <Tag className={variantStyles[variant] ?? variantStyles.p}>{content}</Tag>;
}

function ImageComponent({ node }: DynamicRendererProps) {
  const src = (node.src as string) ?? '';
  const alt = (node.alt as string) ?? '';
  const width = node.width as string | number | undefined;
  const height = node.height as string | number | undefined;

  return (
    <img
      src={src}
      alt={alt}
      className="rounded-xl object-cover"
      style={{
        width: width ? (typeof width === 'number' ? `${width}px` : width) : undefined,
        height: height ? (typeof height === 'number' ? `${height}px` : height) : undefined,
      }}
    />
  );
}

function BadgeComponent({ node }: DynamicRendererProps) {
  const variant = (node.variant as string) ?? 'default';
  const content = (node.content as string) ?? (node.label as string) ?? '';

  const variants: Record<string, string> = {
    default: 'bg-[#FF5A5F] text-white',
    secondary: 'bg-[#F7F7F7] text-[#222222]',
    outline: 'border border-[#DDDDDD] text-[#222222] bg-white',
    success: 'bg-green-100 text-green-800',
    warning: 'bg-yellow-100 text-yellow-800',
    destructive: 'bg-red-100 text-red-800',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        variants[variant] ?? variants.default,
      )}
    >
      {content}
    </span>
  );
}

function AvatarComponent({ node }: DynamicRendererProps) {
  const src = node.src as string | undefined;
  const alt = (node.alt as string) ?? '';
  const fallback = (node.fallback as string) ?? (node.initials as string) ?? alt.slice(0, 2).toUpperCase();
  const size = Number(node.size) || 40;
  const [imgError, setImgError] = React.useState(false);

  return (
    <div
      className="rounded-full overflow-hidden bg-[#F7F7F7] flex items-center justify-center shrink-0"
      style={{ width: size, height: size }}
    >
      {src && !imgError ? (
        <img
          src={src}
          alt={alt}
          className="w-full h-full object-cover"
          onError={() => setImgError(true)}
        />
      ) : (
        <span
          className="text-[#717171] font-medium"
          style={{ fontSize: size * 0.4 }}
        >
          {fallback}
        </span>
      )}
    </div>
  );
}

function ProgressComponent({ node }: DynamicRendererProps) {
  const value = Math.max(0, Math.min(100, Number(node.value) || 0));
  const label = node.label as string | undefined;

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <div className="flex justify-between text-sm">
          <span className="text-[#222222] font-medium">{label}</span>
          <span className="text-[#717171]">{value}%</span>
        </div>
      )}
      <div className="w-full h-2 bg-[#DDDDDD] rounded-full overflow-hidden">
        <div
          className="h-full bg-[#FF5A5F] rounded-full transition-all"
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

function AlertComponent({ node, onAction }: DynamicRendererProps) {
  const variant = (node.variant as string) ?? 'default';
  const title = node.title as string | undefined;
  const description = (node.description as string) ?? (node.content as string) ?? '';

  const variants: Record<string, string> = {
    default: 'border-[#DDDDDD] bg-white text-[#222222]',
    info: 'border-blue-200 bg-blue-50 text-blue-900',
    success: 'border-green-200 bg-green-50 text-green-900',
    warning: 'border-yellow-200 bg-yellow-50 text-yellow-900',
    destructive: 'border-red-200 bg-red-50 text-red-900',
  };

  return (
    <div
      className={cn(
        'border rounded-xl p-4',
        variants[variant] ?? variants.default,
      )}
    >
      {title && <h4 className="font-medium mb-1">{title}</h4>}
      {description && <p className="text-sm">{description}</p>}
      {renderChildren(node.children, onAction)}
    </div>
  );
}

function DataTableComponent({ node }: DynamicRendererProps) {
  const columns = (node.columns as Array<{ key: string; label: string }>) ?? [];
  const rows = (node.rows as Array<Record<string, unknown>>) ?? [];

  return (
    <div className="border border-[#DDDDDD] rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#F7F7F7] border-b border-[#DDDDDD]">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="text-left px-4 py-3 font-medium text-[#222222]"
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={i}
                className={cn(
                  'border-b border-[#DDDDDD] last:border-b-0',
                  i % 2 === 1 && 'bg-[#F7F7F7]/50',
                )}
              >
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-3 text-[#222222]">
                    {String(row[col.key] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={columns.length || 1}
                  className="px-4 py-6 text-center text-[#717171]"
                >
                  No data
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CarouselComponent({ node, onAction }: DynamicRendererProps) {
  const children = node.children ?? [];
  const scrollRef = React.useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const amount = scrollRef.current.clientWidth * 0.8;
    scrollRef.current.scrollBy({
      left: direction === 'left' ? -amount : amount,
      behavior: 'smooth',
    });
  };

  return (
    <div className="relative group">
      {/* Previous button */}
      <button
        onClick={() => scroll('left')}
        className="absolute left-2 top-1/2 -translate-y-1/2 z-10 bg-white border border-[#DDDDDD] rounded-full w-8 h-8 flex items-center justify-center shadow-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[#F7F7F7]"
      >
        &#8249;
      </button>
      {/* Scrollable content */}
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto scroll-smooth snap-x snap-mandatory"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {children.map((child, i) => (
          <div key={child.id ?? i} className="snap-start shrink-0">
            <DynamicRenderer node={child} onAction={onAction} />
          </div>
        ))}
      </div>
      {/* Next button */}
      <button
        onClick={() => scroll('right')}
        className="absolute right-2 top-1/2 -translate-y-1/2 z-10 bg-white border border-[#DDDDDD] rounded-full w-8 h-8 flex items-center justify-center shadow-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[#F7F7F7]"
      >
        &#8250;
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Special components
// ---------------------------------------------------------------------------

function MapViewComponent({ node }: DynamicRendererProps) {
  const markers = (node.markers as unknown[]) ?? [];
  return (
    <div className="border border-[#DDDDDD] rounded-xl bg-[#F7F7F7] flex items-center justify-center p-8 text-[#717171]">
      <div className="text-center">
        <div className="text-2xl mb-2">&#128506;</div>
        <p className="text-sm font-medium">Map: {markers.length} marker{markers.length !== 1 ? 's' : ''}</p>
      </div>
    </div>
  );
}

function ChartComponent({ node }: DynamicRendererProps) {
  const chartType = (node.chartType as string) ?? (node.variant as string) ?? 'bar';
  return (
    <div className="border border-[#DDDDDD] rounded-xl bg-[#F7F7F7] flex items-center justify-center p-8 text-[#717171]">
      <div className="text-center">
        <div className="text-2xl mb-2">&#128200;</div>
        <p className="text-sm font-medium">Chart: {chartType}</p>
      </div>
    </div>
  );
}

function StarRatingComponent({ node, onAction }: DynamicRendererProps) {
  const maxStars = Number(node.max) || 5;
  const defaultVal = Number(node.value ?? node.defaultValue) || 0;
  const [rating, setRating] = React.useState(defaultVal);
  const [hover, setHover] = React.useState(0);
  const readonly = !!node.readonly;
  const label = node.label as string | undefined;

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-sm font-medium text-[#222222]">{label}</label>
      )}
      <div className="flex gap-0.5">
        {Array.from({ length: maxStars }, (_, i) => {
          const starNum = i + 1;
          const filled = starNum <= (hover || rating);
          return (
            <span
              key={i}
              className={cn(
                'text-xl select-none',
                filled ? 'text-[#FF5A5F]' : 'text-[#DDDDDD]',
                !readonly && 'cursor-pointer',
              )}
              onMouseEnter={() => !readonly && setHover(starNum)}
              onMouseLeave={() => !readonly && setHover(0)}
              onClick={() => {
                if (readonly) return;
                setRating(starNum);
                if (node.action && onAction) {
                  onAction(node.action as string, { id: node.id, value: starNum });
                }
              }}
            >
              {filled ? '\u2605' : '\u2606'}
            </span>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component map
// ---------------------------------------------------------------------------

const componentMap: Record<
  string,
  React.FC<DynamicRendererProps>
> = {
  // Layout
  Column: ColumnComponent,
  Row: RowComponent,
  Grid: GridComponent,
  Card: CardComponent,
  Tabs: TabsComponent,
  TabPanel: TabPanelComponent,
  Accordion: AccordionComponent,
  AccordionItem: AccordionItemComponent,
  Separator: SeparatorComponent,

  // Input
  Button: ButtonComponent,
  Input: InputComponent,
  Textarea: TextareaComponent,
  Select: SelectComponent,
  Checkbox: CheckboxComponent,
  RadioGroup: RadioGroupComponent,
  Slider: SliderComponent,
  Calendar: CalendarComponent,
  Switch: SwitchComponent,

  // Display
  Text: TextComponent,
  Image: ImageComponent,
  Badge: BadgeComponent,
  Avatar: AvatarComponent,
  Progress: ProgressComponent,
  Alert: AlertComponent,
  DataTable: DataTableComponent,
  Carousel: CarouselComponent,

  // Special
  MapView: MapViewComponent,
  Chart: ChartComponent,
  StarRating: StarRatingComponent,
};

// ---------------------------------------------------------------------------
// Main renderer
// ---------------------------------------------------------------------------

export function DynamicRenderer({ node, onAction }: DynamicRendererProps) {
  const Component = componentMap[node.type];

  if (!Component) {
    return (
      <div className="border border-yellow-300 bg-yellow-50 rounded-lg px-3 py-2 text-xs text-yellow-800">
        Unknown component type: <code className="font-mono">{node.type}</code>
      </div>
    );
  }

  return <Component node={node} onAction={onAction} />;
}

export default DynamicRenderer;
