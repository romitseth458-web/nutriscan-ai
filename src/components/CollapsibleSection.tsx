import type { ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

interface CollapsibleSectionProps {
  id: string;
  title: string;
  summaryText?: string;
  icon: ReactNode;
  isOpen: boolean;
  onToggle: () => void;
  quickAction?: ReactNode;
  children: ReactNode;
}

export function CollapsibleSection({
  id,
  title,
  summaryText,
  icon,
  isOpen,
  onToggle,
  quickAction,
  children,
}: CollapsibleSectionProps) {
  return (
    <section
      id={id}
      className="scroll-mt-16 overflow-hidden rounded-2xl border border-[#EEDCE0] bg-white"
    >
      <div className="flex items-center justify-between gap-2 px-4 py-3 sm:px-5">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={isOpen}
          className="flex min-h-[44px] min-w-0 flex-1 items-center gap-3 text-left transition-colors hover:opacity-90 cursor-pointer"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#FDF2F4] text-[#BE123C]">
            {icon}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="truncate font-display text-sm font-bold text-[#241118] sm:text-base">
              {title}
            </h2>
            {summaryText && (
              <p className="truncate font-mono text-[11px] text-[#644A52] tabular-nums">
                {summaryText}
              </p>
            )}
          </div>
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#FFF8F9] text-[#644A52]">
            <ChevronDown
              className={`h-4 w-4 transition-transform duration-200 ${
                isOpen ? 'rotate-180 text-[#BE123C]' : ''
              }`}
              aria-hidden="true"
            />
          </span>
        </button>

        {quickAction && <div className="shrink-0">{quickAction}</div>}
      </div>

      {isOpen && <div className="border-t border-[#F2DFE3]">{children}</div>}
    </section>
  );
}
