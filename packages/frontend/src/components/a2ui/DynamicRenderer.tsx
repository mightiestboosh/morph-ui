import React from 'react';
import ReactDOM from 'react-dom';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ComponentNode {
  type: string;
  id?: string;
  action?: string;
  required?: boolean;
  children?: ComponentNode[];
  [key: string]: unknown;
}

export interface FormHandle {
  setValue: (id: string, value: unknown) => void;
  getValues: () => Record<string, unknown>;
  getControls: () => Array<{ id: string; type: string; value?: unknown; [key: string]: unknown }>;
}

export interface DynamicRendererProps {
  node: ComponentNode;
  onAction?: (action: string, data?: Record<string, unknown>) => void;
  formRef?: React.Ref<FormHandle>;
}

// ---------------------------------------------------------------------------
// Form context
// ---------------------------------------------------------------------------

interface FormContextValue {
  values: Record<string, unknown>;
  errors: Record<string, string>;
  setValue: (id: string, value: unknown) => void;
  setError: (id: string, error: string) => void;
  clearError: (id: string) => void;
  registerRequired: (id: string) => void;
  unregisterRequired: (id: string) => void;
  validate: () => boolean;
}

const FormContext = React.createContext<FormContextValue | null>(null);

function useFormContext() {
  return React.useContext(FormContext);
}

// ---------------------------------------------------------------------------
// Animation context — tracks stagger index for entrance animations
// ---------------------------------------------------------------------------

interface AnimationContextValue {
  getIndex: () => number;
}

const AnimationContext = React.createContext<AnimationContextValue | null>(null);

function useAnimationIndex(): number {
  const ctx = React.useContext(AnimationContext);
  const indexRef = React.useRef<number | null>(null);
  if (indexRef.current === null) {
    indexRef.current = ctx ? ctx.getIndex() : 0;
  }
  return indexRef.current;
}

// Components that are "leaf" interactive/display elements and should animate individually
const animatableTypes = new Set([
  'Input', 'Textarea', 'Select', 'Checkbox', 'RadioGroup', 'Slider',
  'Calendar', 'Switch', 'NumberInput', 'Combobox', 'DateRangePicker',
  'Toggle', 'ToggleGroup', 'Button', 'Text', 'Image', 'Badge', 'Avatar',
  'Progress', 'Alert', 'DataTable', 'Chart', 'MapView', 'StarRating',
  'Card', 'Table', 'Skeleton', 'Spinner',
  '_SendButton',
]);

// ---------------------------------------------------------------------------
// Portal dropdown — renders floating menus outside the overflow context
// ---------------------------------------------------------------------------

function Portal({ children }: { children: React.ReactNode }) {
  return ReactDOM.createPortal(children, document.body);
}

function useFloatingPosition(
  triggerRef: React.RefObject<HTMLElement | null>,
  open: boolean,
  align: 'start' | 'center' | 'end' = 'start',
) {
  const [style, setStyle] = React.useState<React.CSSProperties>({});

  React.useEffect(() => {
    if (!open || !triggerRef.current) return;

    const update = () => {
      const rect = triggerRef.current!.getBoundingClientRect();
      const left = align === 'end' ? rect.right : align === 'center' ? rect.left + rect.width / 2 : rect.left;
      setStyle({
        position: 'fixed',
        top: rect.bottom + 4,
        left: align === 'end' ? undefined : left,
        right: align === 'end' ? window.innerWidth - rect.right : undefined,
        width: align === 'start' ? rect.width : undefined,
        minWidth: align !== 'start' ? rect.width : undefined,
        zIndex: 9999,
      });
    };

    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [open, triggerRef, align]);

  return style;
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
    <DynamicRendererInner key={child.id ?? i} node={child} onAction={onAction} />
  ));
}

// Gap helper -- converts a number gap prop to a Tailwind gap class (minimum gap-3 = 12px)
function gapClass(gap?: unknown, minGap?: number): string {
  const floor = minGap ?? 3;
  if (gap === undefined || gap === null) return 'gap-5';
  const n = Number(gap);
  if (Number.isNaN(n)) return 'gap-5';
  if (n <= 0) return 'gap-5'; // enforce minimum
  if (n < floor) return `gap-${floor}`;
  return `gap-${n}`;
}

// Returns a minimum gap of 5 when children contain Cards
function gapForChildren(gap: unknown, children?: ComponentNode[]): string {
  const hasCards = children?.some((c) => c.type === 'Card');
  return gapClass(gap, hasCards ? 5 : undefined);
}

// Normalize options: handles both string[] and {label, value}[]
function normalizeOptions(raw: unknown): Array<{ label: string; value: string }> {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    if (typeof item === 'string') return { label: item, value: item };
    if (item && typeof item === 'object' && 'label' in item) {
      return { label: String((item as any).label), value: String((item as any).value ?? (item as any).label) };
    }
    return { label: String(item), value: String(item) };
  });
}

// ---------------------------------------------------------------------------
// Layout components
// ---------------------------------------------------------------------------

function ColumnComponent({ node, onAction }: DynamicRendererProps) {
  return (
    <div className={cn('flex flex-col', gapForChildren(node.gap, node.children))}>
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
  const align = alignMap[node.align as string] ?? 'items-stretch';
  const children = node.children ?? [];

  // Detect if this Row has a mix of fixed-size (Calendar, etc.) and flexible children
  const fixedTypes = new Set(['Calendar', 'DateRangePicker', 'MapView', 'Chart', 'Image']);
  const hasFixed = children.some((c) => fixedTypes.has(c.type));

  if (hasFixed && children.length >= 2) {
    // Use CSS grid with balanced columns: fixed-size components get auto width,
    // flexible children share remaining space equally
    const templateParts = children.map((c) =>
      fixedTypes.has(c.type) ? 'auto' : '1fr'
    );
    return (
      <div
        className={cn('grid', align, gapForChildren(node.gap, children))}
        style={{ gridTemplateColumns: templateParts.join(' ') }}
      >
        {children.map((child, i) => (
          <div key={child.id ?? i} className="min-w-0">
            <DynamicRendererInner node={child} onAction={onAction} />
          </div>
        ))}
      </div>
    );
  }

  // Standard flex row for non-mixed content
  const wrap = node.wrap === false ? '' : 'flex-wrap';
  return (
    <div className={cn('flex flex-row', wrap, align, gapForChildren(node.gap, children))}>
      {children.map((child, i) => (
        <div key={child.id ?? i}>
          <DynamicRendererInner node={child} onAction={onAction} />
        </div>
      ))}
    </div>
  );
}

function GridComponent({ node, onAction }: DynamicRendererProps) {
  const cols = Number(node.columns) || 2;
  const alignMap: Record<string, string> = { start: 'items-start', center: 'items-center', end: 'items-end', stretch: 'items-stretch' };
  const align = alignMap[node.align as string] ?? 'items-stretch';
  return (
    <div
      className={cn('grid', align, gapForChildren(node.gap, node.children))}
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
    >
      {renderChildren(node.children, onAction)}
    </div>
  );
}

function CardComponent({ node, onAction }: DynamicRendererProps) {
  const selectable = !!node.selectable;
  const handleClick = selectable && onAction ? () => {
    // Collect all scalar props as selection data (exclude children, type, selectable)
    const data: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node)) {
      if (['type', 'children', 'selectable', 'action', 'required'].includes(k)) continue;
      if (typeof v !== 'object' || v === null) data[k] = v;
    }
    onAction(
      (node.action as string) ?? 'select_item',
      data,
    );
  } : undefined;

  return (
    <div
      className={cn(
        'border border-border rounded-xl shadow-sm p-6 bg-white/80 backdrop-blur-sm',
        selectable && 'cursor-pointer transition-all duration-150 hover:border-primary/50 hover:shadow-md hover:bg-white/90 active:scale-[0.99]',
      )}
      onClick={handleClick}
      role={selectable ? 'button' : undefined}
      tabIndex={selectable ? 0 : undefined}
      onKeyDown={selectable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleClick?.(); } } : undefined}
    >
      {node.title ? (
        <h3 className="text-lg font-semibold text-foreground mb-1">
          {String(node.title)}
        </h3>
      ) : null}
      {node.description ? (
        <p className="text-sm text-muted-foreground mb-4">
          {String(node.description)}
        </p>
      ) : null}
      <div className="flex flex-col gap-5">
        {renderChildren(node.children, onAction)}
      </div>
    </div>
  );
}

function TabsComponent({ node, onAction }: DynamicRendererProps) {
  const panels = (node.children ?? []).filter((c) => c.type === 'TabPanel');
  const [activeIndex, setActiveIndex] = React.useState(0);

  return (
    <div>
      {/* Tab headers */}
      <div className="flex gap-1 border-b border-border mb-4">
        {panels.map((panel, i) => {
          const label = (panel.label as string) ?? `Tab ${i + 1}`;
          const active = i === activeIndex;
          return (
            <button
              key={panel.id ?? i}
              onClick={() => setActiveIndex(i)}
              className={cn(
                'px-5 py-2.5 text-[15px] font-medium transition-all duration-200 -mb-px rounded-t-lg',
                active
                  ? 'border-b-2 border-primary text-foreground bg-muted/50'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/30 border-b-2 border-transparent',
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
    <div className="divide-y divide-border border border-border rounded-xl overflow-hidden">
      {items.map((item, i) => {
        const isOpen = openSet.has(i);
        const title = (item.title as string) ?? `Section ${i + 1}`;
        return (
          <div key={item.id ?? i}>
            <button
              onClick={() => toggle(i)}
              className="w-full flex items-center justify-between px-4 py-3 text-left text-sm font-medium text-foreground hover:bg-muted transition-colors"
            >
              <span>{title}</span>
              <span
                className={cn(
                  'transition-transform text-muted-foreground',
                  isOpen && 'rotate-180',
                )}
              >
                &#9662;
              </span>
            </button>
            {isOpen && (
              <div className="px-4 pb-3 text-sm text-foreground">
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
    <div className="border border-border rounded-xl overflow-hidden mb-2">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 text-left text-sm font-medium text-foreground hover:bg-muted"
      >
        <span>{title}</span>
        <span className={cn('transition-transform text-muted-foreground', open && 'rotate-180')}>
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
  return <hr className="border-border my-3" />;
}

// ---------------------------------------------------------------------------
// Input components
// ---------------------------------------------------------------------------

function ButtonComponent({ node, onAction }: DynamicRendererProps) {
  const ctx = useFormContext();
  const variant = (node.variant as string) ?? 'default';
  const base =
    'inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50';

  const variants: Record<string, string> = {
    default: 'bg-primary text-primary-foreground hover:bg-primary-dark focus:ring-primary',
    outline:
      'border border-border bg-white/60 text-foreground hover:bg-muted focus:ring-primary',
    secondary: 'bg-muted text-foreground hover:bg-muted/80 focus:ring-primary',
    ghost: 'text-foreground hover:bg-muted focus:ring-primary',
    destructive: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-600',
  };

  return (
    <button
      className={cn(base, variants[variant] ?? variants.default)}
      disabled={!!node.disabled}
      onClick={() => {
        if (node.action && onAction) {
          if (ctx) {
            const valid = ctx.validate();
            if (!valid) return;
            onAction(node.action as string, { id: node.id, ...ctx.values });
          } else {
            onAction(node.action as string, { id: node.id });
          }
        }
      }}
    >
      {(node.label as string) ?? (node.content as string) ?? 'Button'}
    </button>
  );
}

function InputComponent({ node, onAction }: DynamicRendererProps) {
  const ctx = useFormContext();
  const [value, setValue] = React.useState((node.defaultValue as string) ?? '');
  const label = node.label as string | undefined;
  const placeholder = (node.placeholder as string) ?? '';
  const error = node.id ? ctx?.errors[node.id] : undefined;

  React.useEffect(() => {
    if (!node.id || !ctx) return;
    if (node.required) ctx.registerRequired(node.id);
    ctx.setValue(node.id, value);
    return () => { if (node.id && node.required) ctx.unregisterRequired(node.id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fireAction = (val: string) => {
    if (node.action && onAction) {
      onAction(node.action as string, { id: node.id, value: val });
    }
  };

  const handleChange = (val: string) => {
    setValue(val);
    if (node.id && ctx) {
      ctx.setValue(node.id, val);
      ctx.clearError(node.id);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {label && (
        <label className="text-sm font-medium text-foreground">{label}</label>
      )}
      <input
        type={(node.inputType as string) ?? 'text'}
        className={cn(
          'border rounded-lg px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-white/60',
          error ? 'border-destructive' : 'border-border',
        )}
        placeholder={placeholder}
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={() => fireAction(value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') fireAction(value);
        }}
      />
      {error && <p className="text-sm text-destructive mt-1">{error}</p>}
    </div>
  );
}

function TextareaComponent({ node, onAction }: DynamicRendererProps) {
  const ctx = useFormContext();
  const [value, setValue] = React.useState((node.defaultValue as string) ?? '');
  const label = node.label as string | undefined;
  const error = node.id ? ctx?.errors[node.id] : undefined;

  React.useEffect(() => {
    if (!node.id || !ctx) return;
    if (node.required) ctx.registerRequired(node.id);
    ctx.setValue(node.id, value);
    return () => { if (node.id && node.required) ctx.unregisterRequired(node.id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fireAction = (val: string) => {
    if (node.action && onAction) {
      onAction(node.action as string, { id: node.id, value: val });
    }
  };

  const handleChange = (val: string) => {
    setValue(val);
    if (node.id && ctx) {
      ctx.setValue(node.id, val);
      ctx.clearError(node.id);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {label && (
        <label className="text-sm font-medium text-foreground">{label}</label>
      )}
      <textarea
        className={cn(
          'border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent min-h-[80px] resize-y bg-white/60',
          error ? 'border-destructive' : 'border-border',
        )}
        placeholder={(node.placeholder as string) ?? ''}
        value={value}
        rows={Number(node.rows) || 3}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={() => fireAction(value)}
      />
      {error && <p className="text-sm text-destructive mt-1">{error}</p>}
    </div>
  );
}

function SelectComponent({ node, onAction }: DynamicRendererProps) {
  const ctx = useFormContext();
  const options = normalizeOptions(node.options);
  const placeholder = (node.placeholder as string) ?? 'Select...';
  const [value, setValue] = React.useState(
    (node.defaultValue as string) ?? '',
  );
  const label = node.label as string | undefined;
  const [open, setOpen] = React.useState(false);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const dropdownRef = React.useRef<HTMLDivElement>(null);
  const error = node.id ? ctx?.errors[node.id] : undefined;
  const floatingStyle = useFloatingPosition(triggerRef, open);

  React.useEffect(() => {
    if (!node.id || !ctx) return;
    if (node.required) ctx.registerRequired(node.id);
    ctx.setValue(node.id, value);
    return () => { if (node.id && node.required) ctx.unregisterRequired(node.id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Close on outside click
  React.useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (dropdownRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const selectedLabel = options.find((o) => o.value === value)?.label ?? '';

  return (
    <div className="flex flex-col gap-2">
      {label && (
        <label className="text-sm font-medium text-foreground">{label}</label>
      )}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          'w-full flex items-center justify-between border rounded-lg px-3 py-2.5 text-sm bg-white/60 hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary',
          error ? 'border-destructive' : 'border-border',
        )}
      >
        <span className={selectedLabel ? 'text-foreground' : 'text-muted-foreground'}>{selectedLabel || placeholder}</span>
        <span className="text-muted-foreground">&#9662;</span>
      </button>
      {open && (
        <Portal>
          <div
            ref={dropdownRef}
            className="bg-white border border-border rounded-lg shadow-lg max-h-60 overflow-y-auto py-1"
            style={floatingStyle}
          >
            {options.map((opt) => (
              <button
                key={opt.value}
                onClick={() => {
                  setValue(opt.value);
                  setOpen(false);
                  if (node.id && ctx) {
                    ctx.setValue(node.id, opt.value);
                    ctx.clearError(node.id);
                  }
                  if (node.action && onAction) {
                    onAction(node.action as string, { id: node.id, value: opt.value });
                  }
                }}
                className={cn(
                  'w-full text-left px-3 py-2.5 text-sm hover:bg-muted transition-colors',
                  opt.value === value
                    ? 'text-primary font-medium bg-muted/50'
                    : 'text-foreground',
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </Portal>
      )}
      {error && <p className="text-sm text-destructive mt-1">{error}</p>}
    </div>
  );
}

function CheckboxComponent({ node, onAction }: DynamicRendererProps) {
  const ctx = useFormContext();
  const [checked, setChecked] = React.useState(!!node.defaultChecked);
  const label = (node.label as string) ?? '';
  const error = node.id ? ctx?.errors[node.id] : undefined;

  React.useEffect(() => {
    if (!node.id || !ctx) return;
    if (node.required) ctx.registerRequired(node.id);
    ctx.setValue(node.id, checked);
    return () => { if (node.id && node.required) ctx.unregisterRequired(node.id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = () => {
    const next = !checked;
    setChecked(next);
    if (node.id && ctx) {
      ctx.setValue(node.id, next);
      ctx.clearError(node.id);
    }
    if (node.action && onAction) {
      onAction(node.action as string, { id: node.id, value: next });
    }
  };

  return (
    <div>
      <label
        className="flex items-center gap-2.5 cursor-pointer select-none"
        onClick={(e) => { e.preventDefault(); toggle(); }}
        onKeyDown={(e) => {
          if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            toggle();
          }
        }}
        tabIndex={0}
        role="checkbox"
        aria-checked={checked}
      >
        <span
          className={cn(
            'w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all duration-150 shrink-0',
            checked
              ? 'bg-primary border-primary text-primary-foreground scale-105'
              : error ? 'border-destructive bg-white/60' : 'border-border bg-white/60 hover:border-primary/50',
          )}
        >
          {checked && (
            <svg className="w-3.5 h-3.5" viewBox="0 0 12 12" fill="none">
              <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </span>
        {label && <span className="text-sm text-foreground">{label}</span>}
      </label>
      {error && <p className="text-sm text-destructive mt-1">{error}</p>}
    </div>
  );
}

function RadioGroupComponent({ node, onAction }: DynamicRendererProps) {
  const ctx = useFormContext();
  const options = normalizeOptions(node.options);
  const [value, setValue] = React.useState(
    (node.defaultValue as string) ?? (options[0]?.value ?? ''),
  );
  const label = node.label as string | undefined;
  const error = node.id ? ctx?.errors[node.id] : undefined;

  React.useEffect(() => {
    if (!node.id || !ctx) return;
    if (node.required) ctx.registerRequired(node.id);
    ctx.setValue(node.id, value);
    return () => { if (node.id && node.required) ctx.unregisterRequired(node.id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelect = (optValue: string) => {
    setValue(optValue);
    if (node.id && ctx) {
      ctx.setValue(node.id, optValue);
      ctx.clearError(node.id);
    }
    if (node.action && onAction) {
      onAction(node.action as string, { id: node.id, value: optValue });
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {label && (
        <label className="text-sm font-medium text-foreground">{label}</label>
      )}
      <div className="flex flex-col gap-3">
        {options.map((opt) => (
          <label
            key={opt.value}
            className="flex items-center gap-2 cursor-pointer select-none"
          >
            <span
              role="radio"
              aria-checked={opt.value === value}
              tabIndex={0}
              onClick={() => handleSelect(opt.value)}
              onKeyDown={(e) => {
                if (e.key === ' ' || e.key === 'Enter') {
                  e.preventDefault();
                  handleSelect(opt.value);
                }
              }}
              className={cn(
                'w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors',
                opt.value === value
                  ? 'border-primary'
                  : error ? 'border-destructive' : 'border-border',
              )}
            >
              {opt.value === value && (
                <span className="w-2.5 h-2.5 rounded-full bg-primary" />
              )}
            </span>
            <span className="text-sm text-foreground">{opt.label}</span>
          </label>
        ))}
      </div>
      {error && <p className="text-sm text-destructive mt-1">{error}</p>}
    </div>
  );
}

function SliderComponent({ node, onAction }: DynamicRendererProps) {
  const ctx = useFormContext();
  const min = Number(node.min) || 0;
  const max = Number(node.max) || 100;
  const step = Number(node.step) || 1;
  const defaultVal = Number(node.defaultValue ?? node.default) || min;
  const [value, setValue] = React.useState(defaultVal);
  const label = node.label as string | undefined;
  const error = node.id ? ctx?.errors[node.id] : undefined;

  React.useEffect(() => {
    if (!node.id || !ctx) return;
    if (node.required) ctx.registerRequired(node.id);
    ctx.setValue(node.id, value);
    return () => { if (node.id && node.required) ctx.unregisterRequired(node.id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col gap-2">
      {label && (
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-foreground">{label}</label>
          <span className="text-sm text-muted-foreground">{value}</span>
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
          if (node.id && ctx) {
            ctx.setValue(node.id, v);
            ctx.clearError(node.id);
          }
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
        className="w-full h-2 rounded-full appearance-none bg-border accent-primary cursor-pointer"
      />
      {!label && (
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{min}</span>
          <span>{max}</span>
        </div>
      )}
      {error && <p className="text-sm text-destructive mt-1">{error}</p>}
    </div>
  );
}

function CalendarComponent({ node, onAction }: DynamicRendererProps) {
  const ctx = useFormContext();
  const today = new Date();
  const [viewYear, setViewYear] = React.useState(today.getFullYear());
  const [viewMonth, setViewMonth] = React.useState(today.getMonth());
  const [selected, setSelected] = React.useState<string | null>(
    (node.defaultValue as string) ?? null,
  );
  const error = node.id ? ctx?.errors[node.id] : undefined;

  React.useEffect(() => {
    if (!node.id || !ctx) return;
    if (node.required) ctx.registerRequired(node.id);
    ctx.setValue(node.id, selected ?? '');
    return () => { if (node.id && node.required) ctx.unregisterRequired(node.id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    <div>
      <div className={cn('border rounded-xl p-3 w-fit bg-white/60', error ? 'border-destructive' : 'border-border')}>
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <button onClick={prevMonth} className="p-1 hover:bg-muted rounded-lg text-muted-foreground">
            &#8249;
          </button>
          <span className="text-sm font-medium text-foreground">
            {monthNames[viewMonth]} {viewYear}
          </span>
          <button onClick={nextMonth} className="p-1 hover:bg-muted rounded-lg text-muted-foreground">
            &#8250;
          </button>
        </div>
        {/* Day headers */}
        <div className="grid grid-cols-7 gap-0">
          {dayNames.map((d) => (
            <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1 w-9">
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
                    if (node.id && ctx) {
                      ctx.setValue(node.id, ds);
                      ctx.clearError(node.id);
                    }
                    if (node.action && onAction) {
                      onAction(node.action as string, { id: node.id, value: ds });
                    }
                  }}
                  className={cn(
                    'w-8 h-8 rounded-full text-sm transition-colors',
                    selected === dateStr(day)
                      ? 'bg-primary text-primary-foreground font-medium'
                      : isToday(day)
                        ? 'bg-muted text-foreground font-medium'
                        : 'text-foreground hover:bg-muted',
                  )}
                >
                  {day}
                </button>
              ) : null}
            </div>
          ))}
        </div>
      </div>
      {error && <p className="text-sm text-destructive mt-1">{error}</p>}
    </div>
  );
}

function SwitchComponent({ node, onAction }: DynamicRendererProps) {
  const ctx = useFormContext();
  const [on, setOn] = React.useState(!!node.defaultChecked);
  const label = (node.label as string) ?? '';
  const error = node.id ? ctx?.errors[node.id] : undefined;

  React.useEffect(() => {
    if (!node.id || !ctx) return;
    if (node.required) ctx.registerRequired(node.id);
    ctx.setValue(node.id, on);
    return () => { if (node.id && node.required) ctx.unregisterRequired(node.id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <label className="flex items-center gap-3 cursor-pointer select-none">
        <button
          role="switch"
          aria-checked={on}
          onClick={() => {
            const next = !on;
            setOn(next);
            if (node.id && ctx) {
              ctx.setValue(node.id, next);
              ctx.clearError(node.id);
            }
            if (node.action && onAction) {
              onAction(node.action as string, { id: node.id, value: next });
            }
          }}
          className={cn(
            'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
            on ? 'bg-primary' : 'bg-border',
          )}
        >
          <span
            className={cn(
              'inline-block h-4 w-4 rounded-full bg-white/60 shadow transition-transform',
              on ? 'translate-x-6' : 'translate-x-1',
            )}
          />
        </button>
        {label && <span className="text-sm text-foreground">{label}</span>}
      </label>
      {error && <p className="text-sm text-destructive mt-1">{error}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Display components
// ---------------------------------------------------------------------------

function TextComponent({ node }: DynamicRendererProps) {
  const variant = (node.variant as string) ?? 'p';
  const content = (node.content as string) ?? '';

  const variantStyles: Record<string, string> = {
    h1: 'text-3xl font-bold text-foreground',
    h2: 'text-2xl font-semibold text-foreground',
    h3: 'text-xl font-semibold text-foreground',
    h4: 'text-lg font-medium text-foreground',
    p: 'text-base text-foreground',
    small: 'text-sm text-foreground',
    muted: 'text-sm text-muted-foreground',
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
    default: 'bg-primary text-primary-foreground',
    secondary: 'bg-muted text-foreground',
    outline: 'border border-border text-foreground bg-white/60',
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
      className="rounded-full overflow-hidden bg-muted flex items-center justify-center shrink-0"
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
          className="text-muted-foreground font-medium"
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
          <span className="text-foreground font-medium">{label}</span>
          <span className="text-muted-foreground">{value}%</span>
        </div>
      )}
      <div className="w-full h-2 bg-border rounded-full overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all"
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
    default: 'border-border bg-white/60 text-foreground',
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

function DataTableComponent({ node, onAction }: DynamicRendererProps) {
  const columns = (node.columns as Array<{ key: string; label: string }>) ?? [];
  const rows = (node.rows as Array<Record<string, unknown>>) ?? [];
  const selectable = !!node.selectable;

  const handleRowClick = (row: Record<string, unknown>) => {
    if (!selectable || !onAction) return;
    onAction(
      (node.action as string) ?? 'select_item',
      { ...row },
    );
  };

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted border-b border-border">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="text-left px-4 py-3 font-medium text-foreground"
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
                  'border-b border-border last:border-b-0',
                  i % 2 === 1 && 'bg-muted/50',
                  selectable && 'cursor-pointer transition-colors hover:bg-primary/[0.04] active:bg-primary/[0.08]',
                )}
                onClick={selectable ? () => handleRowClick(row) : undefined}
                role={selectable ? 'button' : undefined}
                tabIndex={selectable ? 0 : undefined}
                onKeyDown={selectable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleRowClick(row); } } : undefined}
              >
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-3 text-foreground">
                    {String(row[col.key] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={columns.length || 1}
                  className="px-4 py-6 text-center text-muted-foreground"
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
        className="absolute left-2 top-1/2 -translate-y-1/2 z-10 bg-white/60 border border-border rounded-full w-8 h-8 flex items-center justify-center shadow-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-muted"
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
            <DynamicRendererInner node={child} onAction={onAction} />
          </div>
        ))}
      </div>
      {/* Next button */}
      <button
        onClick={() => scroll('right')}
        className="absolute right-2 top-1/2 -translate-y-1/2 z-10 bg-white/60 border border-border rounded-full w-8 h-8 flex items-center justify-center shadow-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-muted"
      >
        &#8250;
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Special components
// ---------------------------------------------------------------------------

const LazyMap = React.lazy(() => import('./MapViewLazy'));

function MapViewComponent({ node, onAction }: DynamicRendererProps) {
  return (
    <React.Suspense
      fallback={
        <div className="border border-border rounded-xl bg-muted flex items-center justify-center p-8 text-muted-foreground h-[400px]">
          <div className="text-center">
            <div className="text-2xl mb-2 animate-pulse">&#128506;</div>
            <p className="text-sm font-medium">Loading map...</p>
          </div>
        </div>
      }
    >
      <LazyMap
        node={node}
        selectable={!!node.selectable}
        onSelect={node.selectable && onAction ? (marker) => {
          onAction(
            (node.action as string) ?? 'select_item',
            marker,
          );
        } : undefined}
      />
    </React.Suspense>
  );
}

function StarRatingComponent({ node, onAction }: DynamicRendererProps) {
  const maxStars = Number(node.max || node.maxStars) || 5;
  // Accept many possible prop names for the rating value
  const rawVal = node.value ?? node.defaultValue ?? node.rating ?? node.score ?? 0;
  // Parse string values like "4.5/5" or "4.5 out of 5"
  const parsedVal = typeof rawVal === 'string'
    ? parseFloat(rawVal.replace(/\/.*$/, '').replace(/\s*out\s*of.*$/i, ''))
    : Number(rawVal);
  const defaultVal = isNaN(parsedVal) ? 0 : parsedVal;
  const [rating, setRating] = React.useState(defaultVal);
  const [hover, setHover] = React.useState(0);
  const readonly = !!node.readonly;
  const label = node.label as string | undefined;
  const displayRating = hover || rating;

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-sm font-medium text-foreground">{label}</label>
      )}
      <div className="flex items-center gap-0.5">
        {Array.from({ length: maxStars }, (_, i) => {
          const starNum = i + 1;
          const full = starNum <= Math.floor(displayRating);
          const half = !full && starNum === Math.ceil(displayRating) && displayRating % 1 >= 0.25;
          return (
            <span
              key={i}
              className={cn(
                'text-xl select-none relative',
                !readonly && 'cursor-pointer',
              )}
              style={{ color: full || half ? '#f59e0b' : '#d1d5db' }}
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
              {full ? '\u2605' : half ? (
                <span className="relative inline-block">
                  <span style={{ color: '#d1d5db' }}>{'\u2605'}</span>
                  <span className="absolute inset-0 overflow-hidden" style={{ width: '50%', color: '#f59e0b' }}>{'\u2605'}</span>
                </span>
              ) : '\u2605'}
            </span>
          );
        })}
        {readonly && displayRating > 0 && (
          <span className="text-sm text-muted-foreground ml-1.5">{displayRating.toFixed(1)}</span>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// New components
// ---------------------------------------------------------------------------

function DateRangePickerComponent({ node, onAction }: DynamicRendererProps) {
  const ctx = useFormContext();
  const today = new Date();
  const [startDate, setStartDate] = React.useState<string | null>(null);
  const [endDate, setEndDate] = React.useState<string | null>(null);
  const [leftYear, setLeftYear] = React.useState(today.getFullYear());
  const [leftMonth, setLeftMonth] = React.useState(today.getMonth());
  const error = node.id ? ctx?.errors[node.id] : undefined;

  React.useEffect(() => {
    if (!node.id || !ctx) return;
    if (node.required) ctx.registerRequired(node.id);
    ctx.setValue(node.id, '');
    return () => { if (node.id && node.required) ctx.unregisterRequired(node.id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rightMonth = leftMonth === 11 ? 0 : leftMonth + 1;
  const rightYear = leftMonth === 11 ? leftYear + 1 : leftYear;

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  const dayNames = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  const prevMonth = () => {
    if (leftMonth === 0) { setLeftMonth(11); setLeftYear(leftYear - 1); }
    else setLeftMonth(leftMonth - 1);
  };
  const nextMonth = () => {
    if (leftMonth === 11) { setLeftMonth(0); setLeftYear(leftYear + 1); }
    else setLeftMonth(leftMonth + 1);
  };

  const dateStr = (y: number, m: number, d: number) =>
    `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

  const handleSelect = (ds: string) => {
    if (!startDate || (startDate && endDate)) {
      setStartDate(ds);
      setEndDate(null);
    } else {
      let s: string, e: string;
      if (ds < startDate) {
        setEndDate(startDate);
        setStartDate(ds);
        s = ds;
        e = startDate;
      } else {
        setEndDate(ds);
        s = startDate;
        e = ds;
      }
      if (node.id && ctx) {
        ctx.setValue(node.id, { startDate: s, endDate: e });
        ctx.clearError(node.id);
      }
      if (node.action && onAction) {
        onAction(node.action as string, { id: node.id, startDate: s, endDate: e });
      }
    }
  };

  const isInRange = (ds: string) => {
    if (!startDate || !endDate) return false;
    return ds >= startDate && ds <= endDate;
  };

  const renderMonth = (year: number, month: number) => {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();
    const cells: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);

    return (
      <div>
        <div className="text-center text-sm font-medium text-foreground mb-2">
          {monthNames[month]} {year}
        </div>
        <div className="grid grid-cols-7 gap-0">
          {dayNames.map((d) => (
            <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1 w-9">{d}</div>
          ))}
          {cells.map((day, i) => {
            const ds = day !== null ? dateStr(year, month, day) : '';
            return (
              <div key={i} className="flex items-center justify-center w-9 h-9">
                {day !== null ? (
                  <button
                    onClick={() => handleSelect(ds)}
                    className={cn(
                      'w-8 h-8 rounded-full text-sm transition-colors',
                      ds === startDate || ds === endDate
                        ? 'bg-primary text-primary-foreground font-medium'
                        : isInRange(ds)
                          ? 'bg-primary/20 text-foreground'
                          : 'text-foreground hover:bg-muted',
                    )}
                  >
                    {day}
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div>
      <div className={cn('border rounded-xl p-3 bg-white/60 inline-flex flex-col gap-2', error ? 'border-destructive' : 'border-border')}>
        <div className="flex items-center justify-between">
          <button onClick={prevMonth} className="p-1 hover:bg-muted rounded-lg text-muted-foreground">&#8249;</button>
          <span className="text-xs text-muted-foreground">
            {startDate ?? '...'} &rarr; {endDate ?? '...'}
          </span>
          <button onClick={nextMonth} className="p-1 hover:bg-muted rounded-lg text-muted-foreground">&#8250;</button>
        </div>
        <div className="flex gap-4">
          {renderMonth(leftYear, leftMonth)}
          {renderMonth(rightYear, rightMonth)}
        </div>
      </div>
      {error && <p className="text-sm text-destructive mt-1">{error}</p>}
    </div>
  );
}

function SheetComponent({ node, onAction }: DynamicRendererProps) {
  const [open, setOpen] = React.useState(!!(node.open));
  const title = (node.title as string) ?? '';
  const description = (node.description as string) ?? '';

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary-dark transition-colors"
        >
          {title || 'Open Sheet'}
        </button>
      )}
      {open && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <div className="relative w-full max-w-md bg-white shadow-xl p-6 overflow-y-auto animate-in slide-in-from-right">
            <div className="flex items-center justify-between mb-4">
              <div>
                {title && <h2 className="text-lg font-semibold text-foreground">{title}</h2>}
                {description && <p className="text-sm text-muted-foreground">{description}</p>}
              </div>
              <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground text-xl">&times;</button>
            </div>
            {renderChildren(node.children, onAction)}
          </div>
        </div>
      )}
    </>
  );
}

function CollapsibleComponent({ node, onAction }: DynamicRendererProps) {
  const [open, setOpen] = React.useState(!!(node.open));
  const title = (node.title as string) ?? 'Toggle';

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 text-left text-sm font-medium text-foreground hover:bg-muted transition-colors"
      >
        <span>{title}</span>
        <span className={cn('transition-transform text-muted-foreground', open && 'rotate-180')}>&#9662;</span>
      </button>
      {open && (
        <div className="px-4 pb-3">{renderChildren(node.children, onAction)}</div>
      )}
    </div>
  );
}

function ScrollAreaComponent({ node, onAction }: DynamicRendererProps) {
  const maxHeight = Number(node.maxHeight) || 300;

  return (
    <div
      className="overflow-y-auto border border-border rounded-xl p-3"
      style={{ maxHeight }}
    >
      {renderChildren(node.children, onAction)}
    </div>
  );
}

function LabelComponent({ node }: DynamicRendererProps) {
  const text = (node.text as string) ?? (node.content as string) ?? '';
  const htmlFor = (node.htmlFor as string) ?? undefined;

  return (
    <label htmlFor={htmlFor} className="text-sm font-medium text-foreground">
      {text}
    </label>
  );
}

function SkeletonComponent({ node }: DynamicRendererProps) {
  const variant = (node.variant as string) ?? 'rect';
  const width = node.width as string | number | undefined;
  const height = node.height as string | number | undefined;

  const sizeStyle: React.CSSProperties = {
    width: width ? (typeof width === 'number' ? `${width}px` : width) : '100%',
    height: height ? (typeof height === 'number' ? `${height}px` : height) : variant === 'text' ? '1em' : '40px',
  };

  return (
    <div
      className={cn(
        'animate-pulse bg-muted',
        variant === 'circle' ? 'rounded-full' : variant === 'text' ? 'rounded' : 'rounded-xl',
      )}
      style={sizeStyle}
    />
  );
}

function HoverCardComponent({ node, onAction }: DynamicRendererProps) {
  const [show, setShow] = React.useState(false);
  const content = (node.content as string) ?? '';
  const children = node.children ?? [];

  return (
    <div className="relative inline-block" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      {children.length > 0 ? (
        <DynamicRendererInner node={children[0]} onAction={onAction} />
      ) : (
        <span className="text-primary underline cursor-pointer">Hover me</span>
      )}
      {show && (
        <div className="absolute z-50 mt-2 w-64 p-4 bg-white border border-border rounded-xl shadow-lg text-sm text-foreground">
          {content}
        </div>
      )}
    </div>
  );
}

function TooltipComponent({ node, onAction }: DynamicRendererProps) {
  const [show, setShow] = React.useState(false);
  const content = (node.content as string) ?? '';
  const children = node.children ?? [];

  return (
    <div className="relative inline-block" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      {children.length > 0 ? (
        renderChildren(children, onAction)
      ) : (
        <span className="text-foreground underline cursor-help">?</span>
      )}
      {show && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-foreground text-primary-foreground text-xs rounded whitespace-nowrap shadow">
          {content}
        </div>
      )}
    </div>
  );
}

function AlertDialogComponent({ node, onAction }: DynamicRendererProps) {
  const [open, setOpen] = React.useState(false);
  const title = (node.title as string) ?? 'Are you sure?';
  const description = (node.description as string) ?? '';
  const confirmLabel = (node.confirmLabel as string) ?? 'Confirm';
  const cancelLabel = (node.cancelLabel as string) ?? 'Cancel';

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary-dark transition-colors"
      >
        {title}
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <div className="relative bg-white border border-border rounded-xl shadow-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-foreground mb-1">{title}</h3>
            {description && <p className="text-sm text-muted-foreground mb-4">{description}</p>}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setOpen(false);
                  if (node.cancelAction && onAction) {
                    onAction(node.cancelAction as string, { id: node.id });
                  }
                }}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-border text-foreground hover:bg-muted transition-colors"
              >
                {cancelLabel}
              </button>
              <button
                onClick={() => {
                  setOpen(false);
                  if (node.confirmAction && onAction) {
                    onAction(node.confirmAction as string, { id: node.id });
                  }
                }}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary-dark transition-colors"
              >
                {confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ToastComponent({ node }: DynamicRendererProps) {
  const variant = (node.variant as string) ?? 'default';
  const title = (node.title as string) ?? '';
  const description = (node.description as string) ?? '';

  const variants: Record<string, string> = {
    default: 'border-border bg-white/60 text-foreground',
    success: 'border-green-300 bg-green-50 text-green-900',
    destructive: 'border-red-300 bg-red-50 text-red-900',
  };

  return (
    <div className={cn('border rounded-xl p-4 shadow-md', variants[variant] ?? variants.default)}>
      {title && <h4 className="font-medium text-sm">{title}</h4>}
      {description && <p className="text-sm mt-0.5 opacity-80">{description}</p>}
    </div>
  );
}

function SpinnerComponent({ node }: DynamicRendererProps) {
  const size = (node.size as string) ?? 'md';
  const sizeMap: Record<string, string> = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  };

  return (
    <div className="flex items-center justify-center">
      <div
        className={cn(
          'animate-spin rounded-full border-2 border-muted border-t-primary',
          sizeMap[size] ?? sizeMap.md,
        )}
      />
    </div>
  );
}

function ToggleComponent({ node, onAction }: DynamicRendererProps) {
  const [pressed, setPressed] = React.useState(!!(node.pressed));
  const label = (node.label as string) ?? 'Toggle';

  return (
    <button
      aria-pressed={pressed}
      onClick={() => {
        const next = !pressed;
        setPressed(next);
        if (node.action && onAction) {
          onAction(node.action as string, { id: node.id, value: next });
        }
      }}
      className={cn(
        'inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-medium transition-colors border',
        pressed
          ? 'bg-primary text-primary-foreground border-primary'
          : 'bg-white/60 text-foreground border-border hover:bg-muted',
      )}
    >
      {label}
    </button>
  );
}

function ToggleGroupComponent({ node, onAction }: DynamicRendererProps) {
  const options = normalizeOptions(node.options);
  const [selected, setSelected] = React.useState((node.defaultValue as string) ?? (options[0]?.value ?? ''));

  return (
    <div className="inline-flex rounded-lg border border-border overflow-hidden">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => {
            setSelected(opt.value);
            if (node.action && onAction) {
              onAction(node.action as string, { id: node.id, value: opt.value });
            }
          }}
          className={cn(
            'px-3 py-2 text-sm font-medium transition-colors border-r border-border last:border-r-0',
            opt.value === selected
              ? 'bg-primary text-primary-foreground'
              : 'bg-white/60 text-foreground hover:bg-muted',
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function CommandComponent({ node, onAction }: DynamicRendererProps) {
  const options = normalizeOptions(node.options) as Array<{ label: string; value: string; group?: string }>;
  const placeholder = (node.placeholder as string) ?? 'Search...';
  const [query, setQuery] = React.useState('');
  const [open, setOpen] = React.useState(false);

  const filtered = options.filter((o) =>
    o.label.toLowerCase().includes(query.toLowerCase()),
  );

  const groups = Array.from(new Set(filtered.map((o) => o.group ?? '')));

  return (
    <div className="relative">
      <input
        type="text"
        className="w-full border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary bg-white/60"
        placeholder={placeholder}
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-border rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {groups.map((group) => (
            <div key={group}>
              {group && <div className="px-3 py-1 text-xs font-medium text-muted-foreground">{group}</div>}
              {filtered.filter((o) => (o.group ?? '') === group).map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => {
                    setQuery(opt.label);
                    setOpen(false);
                    if (node.action && onAction) {
                      onAction(node.action as string, { id: node.id, value: opt.value });
                    }
                  }}
                  className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors"
                >
                  {opt.label}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function NumberInputComponent({ node, onAction }: DynamicRendererProps) {
  const ctx = useFormContext();
  const min = Number(node.min) ?? -Infinity;
  const max = Number(node.max) ?? Infinity;
  const step = Number(node.step) || 1;
  const defaultVal = Number(node.defaultValue) || 0;
  const [value, setValue] = React.useState(defaultVal);
  const label = node.label as string | undefined;
  const error = node.id ? ctx?.errors[node.id] : undefined;

  React.useEffect(() => {
    if (!node.id || !ctx) return;
    if (node.required) ctx.registerRequired(node.id);
    ctx.setValue(node.id, value);
    return () => { if (node.id && node.required) ctx.unregisterRequired(node.id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const update = (v: number) => {
    const clamped = Math.min(max, Math.max(min, v));
    setValue(clamped);
    if (node.id && ctx) {
      ctx.setValue(node.id, clamped);
      ctx.clearError(node.id);
    }
    if (node.action && onAction) {
      onAction(node.action as string, { id: node.id, value: clamped });
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {label && <label className="text-sm font-medium text-foreground">{label}</label>}
      <div className={cn('inline-flex items-center border rounded-lg overflow-hidden', error ? 'border-destructive' : 'border-border')}>
        <button
          onClick={() => update(value - step)}
          className="px-3 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors border-r border-border"
        >
          -
        </button>
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(e) => update(Number(e.target.value))}
          className="w-20 text-center py-2 text-sm text-foreground bg-white/60 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
        <button
          onClick={() => update(value + step)}
          className="px-3 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors border-l border-border"
        >
          +
        </button>
      </div>
      {error && <p className="text-sm text-destructive mt-1">{error}</p>}
    </div>
  );
}

function BreadcrumbComponent({ node, onAction }: DynamicRendererProps) {
  const items = (node.items as Array<{ label: string; action?: string }>) ?? [];

  return (
    <nav className="flex items-center gap-1 text-sm">
      {items.map((item, i) => (
        <React.Fragment key={i}>
          {i > 0 && <span className="text-muted-foreground">/</span>}
          {item.action ? (
            <button
              onClick={() => onAction && onAction(item.action!, { index: i })}
              className="text-primary hover:underline"
            >
              {item.label}
            </button>
          ) : (
            <span className={i === items.length - 1 ? 'text-foreground font-medium' : 'text-muted-foreground'}>
              {item.label}
            </span>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
}

function PaginationComponent({ node, onAction }: DynamicRendererProps) {
  const total = Number(node.total) || 0;
  const pageSize = Number(node.pageSize) || 10;
  const [currentPage, setCurrentPage] = React.useState(Number(node.currentPage) || 1);
  const totalPages = Math.ceil(total / pageSize);

  const goTo = (page: number) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
    if (node.action && onAction) {
      onAction(node.action as string, { id: node.id, page });
    }
  };

  const pages: (number | string)[] = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
      pages.push(i);
    } else if (pages[pages.length - 1] !== '...') {
      pages.push('...');
    }
  }

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => goTo(currentPage - 1)}
        disabled={currentPage <= 1}
        className="px-2 py-1 text-sm rounded-lg text-muted-foreground hover:bg-muted disabled:opacity-50 transition-colors"
      >
        &laquo;
      </button>
      {pages.map((p, i) =>
        typeof p === 'number' ? (
          <button
            key={i}
            onClick={() => goTo(p)}
            className={cn(
              'w-8 h-8 text-sm rounded-lg transition-colors',
              p === currentPage
                ? 'bg-primary text-primary-foreground font-medium'
                : 'text-foreground hover:bg-muted',
            )}
          >
            {p}
          </button>
        ) : (
          <span key={i} className="text-muted-foreground px-1">...</span>
        ),
      )}
      <button
        onClick={() => goTo(currentPage + 1)}
        disabled={currentPage >= totalPages}
        className="px-2 py-1 text-sm rounded-lg text-muted-foreground hover:bg-muted disabled:opacity-50 transition-colors"
      >
        &raquo;
      </button>
    </div>
  );
}

function ComboboxComponent({ node, onAction }: DynamicRendererProps) {
  const ctx = useFormContext();
  const options = normalizeOptions(node.options);
  const placeholder = (node.placeholder as string) ?? 'Search...';
  const label = node.label as string | undefined;
  const [query, setQuery] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const dropdownRef = React.useRef<HTMLDivElement>(null);
  const error = node.id ? ctx?.errors[node.id] : undefined;
  const floatingStyle = useFloatingPosition(inputRef, open);

  React.useEffect(() => {
    if (!node.id || !ctx) return;
    if (node.required) ctx.registerRequired(node.id);
    ctx.setValue(node.id, selected ?? '');
    return () => { if (node.id && node.required) ctx.unregisterRequired(node.id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (inputRef.current?.contains(target)) return;
      if (dropdownRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const filtered = options.filter((o) =>
    o.label.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div className="flex flex-col gap-2">
      {label && <label className="text-sm font-medium text-foreground">{label}</label>}
      <input
        ref={inputRef}
        type="text"
        className={cn(
          'w-full border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary bg-white/60',
          error ? 'border-destructive' : 'border-border',
        )}
        placeholder={placeholder}
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
      />
      {open && filtered.length > 0 && (
        <Portal>
          <div
            ref={dropdownRef}
            className="bg-white border border-border rounded-lg shadow-lg max-h-60 overflow-y-auto py-1"
            style={floatingStyle}
          >
            {filtered.map((opt) => (
              <button
                key={opt.value}
                onClick={() => {
                  setSelected(opt.value);
                  setQuery(opt.label);
                  setOpen(false);
                  if (node.id && ctx) {
                    ctx.setValue(node.id, opt.value);
                    ctx.clearError(node.id);
                  }
                  if (node.action && onAction) {
                    onAction(node.action as string, { id: node.id, value: opt.value });
                  }
                }}
                className={cn(
                  'w-full text-left px-3 py-2.5 text-sm hover:bg-muted transition-colors',
                  opt.value === selected ? 'text-primary font-medium bg-muted/50' : 'text-foreground',
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </Portal>
      )}
      {error && <p className="text-sm text-destructive mt-1">{error}</p>}
    </div>
  );
}

function TableComponent({ node }: DynamicRendererProps) {
  const columns = (node.columns as string[]) ?? [];
  const rows = (node.rows as string[][]) ?? [];

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted border-b border-border">
              {columns.map((col, i) => (
                <th key={i} className="text-left px-4 py-3 font-medium text-foreground">{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className={cn('border-b border-border last:border-b-0', i % 2 === 1 && 'bg-muted/50')}>
                {row.map((cell, j) => (
                  <td key={j} className="px-4 py-3 text-foreground">{cell}</td>
                ))}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={columns.length || 1} className="px-4 py-6 text-center text-muted-foreground">No data</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DropdownMenuComponent({ node, onAction }: DynamicRendererProps) {
  const label = (node.label as string) ?? 'Menu';
  const items = (node.items as Array<{ label: string; action: string }>) ?? [];
  const [open, setOpen] = React.useState(false);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const dropdownRef = React.useRef<HTMLDivElement>(null);
  const floatingStyle = useFloatingPosition(triggerRef, open);

  React.useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (dropdownRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="inline-block">
      <button
        ref={triggerRef}
        onClick={() => setOpen(!open)}
        className="inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium bg-white/60 border border-border text-foreground hover:bg-muted transition-colors"
      >
        {label}
        <span className="ml-2 text-muted-foreground">&#9662;</span>
      </button>
      {open && (
        <Portal>
          <div
            ref={dropdownRef}
            className="min-w-[160px] bg-white border border-border rounded-lg shadow-lg overflow-hidden py-1"
            style={floatingStyle}
          >
            {items.map((item, i) => (
              <button
                key={i}
                onClick={() => {
                  setOpen(false);
                  if (onAction) onAction(item.action, { id: node.id });
                }}
                className="w-full text-left px-3 py-2.5 text-sm text-foreground hover:bg-muted transition-colors"
              >
                {item.label}
              </button>
            ))}
          </div>
        </Portal>
      )}
    </div>
  );
}

function ContextMenuComponent({ node, onAction }: DynamicRendererProps) {
  const items = (node.items as Array<{ label: string; action: string }>) ?? [];
  const [menu, setMenu] = React.useState<{ x: number; y: number } | null>(null);

  React.useEffect(() => {
    if (!menu) return;
    const handler = () => setMenu(null);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [menu]);

  return (
    <div
      onContextMenu={(e) => {
        e.preventDefault();
        setMenu({ x: e.clientX, y: e.clientY });
      }}
    >
      {renderChildren(node.children, onAction)}
      {menu && (
        <div
          className="fixed z-50 min-w-[160px] bg-white border border-border rounded-lg shadow-lg overflow-hidden"
          style={{ left: menu.x, top: menu.y }}
        >
          {items.map((item, i) => (
            <button
              key={i}
              onClick={() => {
                setMenu(null);
                if (onAction) onAction(item.action, { id: node.id });
              }}
              className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors"
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function PopoverComponent({ node, onAction }: DynamicRendererProps) {
  const trigger = (node.trigger as string) ?? 'Click me';
  const [open, setOpen] = React.useState(false);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const popoverRef = React.useRef<HTMLDivElement>(null);
  const floatingStyle = useFloatingPosition(triggerRef, open);

  React.useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (popoverRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="inline-block">
      <button
        ref={triggerRef}
        onClick={() => setOpen(!open)}
        className="text-primary underline text-sm cursor-pointer"
      >
        {trigger}
      </button>
      {open && (
        <Portal>
          <div
            ref={popoverRef}
            className="w-64 p-4 bg-white border border-border rounded-xl shadow-lg"
            style={floatingStyle}
          >
            {renderChildren(node.children, onAction)}
          </div>
        </Portal>
      )}
    </div>
  );
}

const PIE_COLORS = [
  '#D97706', '#2563EB', '#10B981', '#EF4444', '#8B5CF6',
  '#F59E0B', '#06B6D4', '#EC4899', '#14B8A6', '#F97316',
];

function ChartComponent({ node, onAction }: DynamicRendererProps) {
  const chartType = (node.chartType as string) ?? (node.variant as string) ?? 'bar';
  const data = (node.data as Array<Record<string, unknown>>) ?? [];
  const xKey = (node.xKey as string) ?? 'name';
  const yKey = (node.yKey as string) ?? 'value';
  const title = (node.title as string) ?? '';
  const color = (node.color as string) ?? '#D97706';
  const selectable = !!node.selectable;

  const handleClick = (entry: Record<string, unknown>) => {
    if (!selectable || !onAction) return;
    onAction(
      (node.action as string) ?? 'select_item',
      { ...entry },
    );
  };

  if (data.length === 0) {
    return (
      <div className="border border-border rounded-xl bg-muted flex items-center justify-center p-8 text-muted-foreground">
        <div className="text-center">
          <div className="text-2xl mb-2">&#128200;</div>
          <p className="text-sm font-medium">Chart: {chartType} (no data)</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      {title && <h4 className="text-sm font-medium text-foreground mb-2">{title}</h4>}
      <ResponsiveContainer width="100%" height={300}>
        {chartType === 'line' ? (
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={xKey} tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <RechartsTooltip />
            <Legend />
            <Line
              type="monotone"
              dataKey={yKey}
              stroke={color}
              strokeWidth={2}
              dot={{ r: 4, cursor: selectable ? 'pointer' : undefined } as Record<string, unknown>}
              activeDot={{ r: 6 }}
              onClick={selectable ? (entry: Record<string, unknown>) => handleClick(entry) : undefined}
            />
          </LineChart>
        ) : chartType === 'area' ? (
          <AreaChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={xKey} tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <RechartsTooltip />
            <Legend />
            <Area type="monotone" dataKey={yKey} stroke={color} fill={color} fillOpacity={0.3} />
          </AreaChart>
        ) : chartType === 'pie' ? (
          <PieChart>
            <Pie
              data={data}
              dataKey={yKey}
              nameKey={xKey}
              cx="50%"
              cy="50%"
              outerRadius={100}
              label
              cursor={selectable ? 'pointer' : undefined}
              onClick={selectable ? (_: unknown, idx: number) => { if (data[idx]) handleClick(data[idx]); } : undefined}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
              ))}
            </Pie>
            <RechartsTooltip />
            <Legend />
          </PieChart>
        ) : (
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={xKey} tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <RechartsTooltip />
            <Legend />
            <Bar
              dataKey={yKey}
              fill={color}
              radius={[4, 4, 0, 0]}
              cursor={selectable ? 'pointer' : undefined}
              onClick={selectable ? (entry: Record<string, unknown>) => handleClick(entry) : undefined}
            />
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component map
// ---------------------------------------------------------------------------

// Internal Send button — injected automatically for input forms
function SendButtonComponent({ node, onAction }: DynamicRendererProps) {
  const ctx = useFormContext();

  return (
    <div className="flex justify-end pt-2">
      <button
        className="inline-flex items-center gap-2.5 rounded-xl px-7 py-3 text-base font-semibold bg-primary text-primary-foreground hover:bg-primary-dark transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary shadow-sm hover:shadow-md"
        onClick={() => {
          // handleSend is wired via the main DynamicRenderer — we use a special action
          if (onAction) {
            if (ctx) {
              const valid = ctx.validate();
              if (!valid) return;
              onAction('__send__', { ...ctx.values });
            } else {
              onAction('__send__', {});
            }
          }
        }}
      >
        Send
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 2L11 13" />
          <path d="M22 2L15 22L11 13L2 9L22 2Z" />
        </svg>
      </button>
    </div>
  );
}

const componentMap: Record<
  string,
  React.FC<DynamicRendererProps>
> = {
  // Internal
  _SendButton: SendButtonComponent,
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

  // New components
  DateRangePicker: DateRangePickerComponent,
  Sheet: SheetComponent,
  Collapsible: CollapsibleComponent,
  ScrollArea: ScrollAreaComponent,
  Label: LabelComponent,
  Skeleton: SkeletonComponent,
  HoverCard: HoverCardComponent,
  Tooltip: TooltipComponent,
  AlertDialog: AlertDialogComponent,
  Toast: ToastComponent,
  Spinner: SpinnerComponent,
  Toggle: ToggleComponent,
  ToggleGroup: ToggleGroupComponent,
  Command: CommandComponent,
  NumberInput: NumberInputComponent,
  Breadcrumb: BreadcrumbComponent,
  Pagination: PaginationComponent,
  Combobox: ComboboxComponent,
  Table: TableComponent,
  DropdownMenu: DropdownMenuComponent,
  ContextMenu: ContextMenuComponent,
  Popover: PopoverComponent,
};

// ---------------------------------------------------------------------------
// Inner renderer (used recursively by children)
// ---------------------------------------------------------------------------

// Case-insensitive componentMap lookup
const componentMapLower: Record<string, React.FC<DynamicRendererProps>> = {};
for (const [key, val] of Object.entries(componentMap)) {
  componentMapLower[key.toLowerCase()] = val;
}

function resolveComponent(type: string): React.FC<DynamicRendererProps> | undefined {
  return componentMap[type] ?? componentMapLower[type.toLowerCase()];
}

function DynamicRendererInner({ node, onAction }: DynamicRendererProps) {
  const Component = resolveComponent(node.type);
  const shouldAnimate = animatableTypes.has(node.type) || animatableTypes.has(node.type.charAt(0).toUpperCase() + node.type.slice(1));
  const staggerIndex = useAnimationIndex();

  if (!Component) {
    return (
      <div className="border border-yellow-300 bg-yellow-50 rounded-lg px-3 py-2 text-xs text-yellow-800">
        Unknown component type: <code className="font-mono">{node.type}</code>
      </div>
    );
  }

  if (shouldAnimate) {
    return (
      <div
        className="a2ui-enter"
        style={{ animationDelay: `${staggerIndex * 50}ms` }}
      >
        <Component node={node} onAction={onAction} />
      </div>
    );
  }

  return <Component node={node} onAction={onAction} />;
}

// ---------------------------------------------------------------------------
// Main renderer with FormProvider
// ---------------------------------------------------------------------------

export function DynamicRenderer({ node, onAction, formRef }: DynamicRendererProps) {
  const [values, setValues] = React.useState<Record<string, unknown>>({});
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const requiredFieldsRef = React.useRef<Set<string>>(new Set());

  const contextValue = React.useMemo<FormContextValue>(() => ({
    values,
    errors,
    setValue: (id: string, value: unknown) => {
      setValues((prev) => ({ ...prev, [id]: value }));
    },
    setError: (id: string, error: string) => {
      setErrors((prev) => ({ ...prev, [id]: error }));
    },
    clearError: (id: string) => {
      setErrors((prev) => {
        if (!(id in prev)) return prev;
        const next = { ...prev };
        delete next[id];
        return next;
      });
    },
    registerRequired: (id: string) => {
      requiredFieldsRef.current.add(id);
    },
    unregisterRequired: (id: string) => {
      requiredFieldsRef.current.delete(id);
    },
    validate: () => {
      const newErrors: Record<string, string> = {};
      for (const id of requiredFieldsRef.current) {
        const val = values[id];
        if (val === undefined || val === null || val === '') {
          newErrors[id] = 'This field is required';
        }
      }
      setErrors(newErrors);
      return Object.keys(newErrors).length === 0;
    },
  }), [values, errors]);

  // Detect if tree has interactive inputs → auto-add Send button
  const hasInputs = React.useMemo(() => {
    const inputTypes = new Set([
      'Input', 'Textarea', 'Select', 'Checkbox', 'RadioGroup', 'Slider',
      'Calendar', 'Switch', 'NumberInput', 'Combobox', 'DateRangePicker',
      'Toggle', 'ToggleGroup',
    ]);
    function check(n: ComponentNode): boolean {
      if (inputTypes.has(n.type)) return true;
      return n.children?.some(check) ?? false;
    }
    return check(node);
  }, [node]);

  // Strip Button/Row-of-Buttons from tree when we'll auto-add Send, then inject SendButton
  const strippedNode = React.useMemo(() => {
    if (!hasInputs) return node;
    function stripButtons(n: ComponentNode): ComponentNode | null {
      if (n.type === 'Button') return null;
      // Remove Rows that only contain Buttons
      if (n.type === 'Row' && n.children?.every((c) => c.type === 'Button')) return null;
      if (!n.children) return n;
      const filtered = n.children
        .map(stripButtons)
        .filter((c): c is ComponentNode => c !== null);
      return { ...n, children: filtered };
    }
    const stripped = stripButtons(node) ?? node;
    // Inject a SendButton as the last child of the root node (inside the Card)
    const sendNode: ComponentNode = { type: '_SendButton', id: '__send_btn' };
    if (stripped.children) {
      // If root has a Column as direct child, append inside it
      const firstChild = stripped.children[0];
      if (stripped.children.length === 1 && firstChild?.type === 'Column' && firstChild.children) {
        return {
          ...stripped,
          children: [{ ...firstChild, children: [...firstChild.children, sendNode] }],
        };
      }
      return { ...stripped, children: [...stripped.children, sendNode] };
    }
    return { ...stripped, children: [sendNode] };
  }, [node, hasInputs]);

  // Find the action string: prefer root node's action prop, then first Button's action
  const primaryAction = React.useMemo(() => {
    if (node.action) return node.action as string;
    function findAction(n: ComponentNode): string | null {
      if (n.action && n.type !== 'Button') return n.action as string;
      if (n.type === 'Button' && n.action) return n.action as string;
      for (const child of n.children ?? []) {
        const a = findAction(child);
        if (a) return a;
      }
      return null;
    }
    return findAction(node) ?? 'submit';
  }, [node]);

  const handleSend = React.useCallback(() => {
    if (!onAction) return;
    const valid = contextValue.validate();
    if (!valid) return;
    onAction(primaryAction, { ...values });
  }, [onAction, contextValue, primaryAction, values]);

  // Expose form handle for external voice commands
  React.useImperativeHandle(formRef, () => ({
    setValue: (id: string, value: unknown) => {
      setValues((prev) => ({ ...prev, [id]: value }));
    },
    getValues: () => values,
    getControls: () => {
      // Walk the component tree to find interactive controls
      const controls: Array<{ id: string; type: string; value?: unknown; [key: string]: unknown }> = [];
      const interactiveTypes = new Set([
        'Input', 'Textarea', 'Select', 'Checkbox', 'RadioGroup', 'Slider',
        'Calendar', 'Switch', 'NumberInput', 'Combobox', 'DateRangePicker',
        'Toggle', 'ToggleGroup',
      ]);
      function walk(n: ComponentNode) {
        if (n.id && interactiveTypes.has(n.type)) {
          const { children, ...meta } = n;
          controls.push({ ...meta, id: n.id, type: n.type, value: values[n.id] });
        }
        if (n.children) n.children.forEach(walk);
      }
      walk(node);
      return controls;
    },
  }), [values, node]);

  // Stagger counter for entrance animations
  const counterRef = React.useRef(0);
  counterRef.current = 0; // reset on each render
  const animCtx = React.useMemo(() => ({
    getIndex: () => counterRef.current++,
  }), []);

  return (
    <AnimationContext.Provider value={animCtx}>
      <FormContext.Provider value={contextValue}>
        <DynamicRendererInner
          node={strippedNode}
          onAction={(action, data) => {
            if (action === '__send__') {
              handleSend();
            } else if (onAction) {
              onAction(action, data);
            }
          }}
        />
      </FormContext.Provider>
    </AnimationContext.Provider>
  );
}

export default DynamicRenderer;
