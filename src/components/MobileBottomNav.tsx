import { BarChart3, Camera, ChefHat, Droplets, LayoutGrid } from 'lucide-react';
import type { DashboardTab } from './CompactDashboardOverview';

interface MobileBottomNavProps {
  activeTab: DashboardTab;
  onSelectTab: (tab: DashboardTab) => void;
}

const BOTTOM_ITEMS: { id: DashboardTab; label: string; icon: typeof LayoutGrid }[] = [
  { id: 'overview', label: 'Home', icon: LayoutGrid },
  { id: 'scanner', label: 'Scan', icon: Camera },
  { id: 'meal-planner', label: 'Plan', icon: ChefHat },
  { id: 'water-tracker', label: 'Water', icon: Droplets },
  { id: 'weekly-report', label: 'Weekly', icon: BarChart3 },
];

export function MobileBottomNav({ activeTab, onSelectTab }: MobileBottomNavProps) {
  return (
    <nav
      aria-label="Mobile quick navigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-[#EEDCE0] bg-white/95 backdrop-blur-md lg:hidden"
    >
      <div className="grid h-14 grid-cols-5 items-center">
        {BOTTOM_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`flex h-full flex-col items-center justify-center gap-0.5 text-[10px] font-semibold transition-colors cursor-pointer ${
                isActive ? 'text-[#BE123C]' : 'text-[#644A52] hover:text-[#241118]'
              }`}
            >
              <Icon
                className={`h-4 w-4 ${isActive ? 'text-[#BE123C]' : 'text-[#644A52]'}`}
                aria-hidden="true"
              />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
