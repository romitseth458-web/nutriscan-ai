import { useState } from 'react';
import { Heart, LogOut, Menu, PhoneCall, User as UserIcon, X } from 'lucide-react';
import type { DashboardTab } from './CompactDashboardOverview';
import { PWAInstallButton } from './PWAInstallButton';

interface NavbarProps {
  activeTab: DashboardTab;
  onSelectTab: (tab: DashboardTab) => void;
  onUploadClick: () => void;
  onOpenVoiceAssistant: () => void;
  onShowToast?: (message: string) => void;
  userDisplayName: string;
  userEmail: string;
  userPhotoUrl?: string;
  onOpenProfile: () => void;
  onLogout: () => void;
}

const NAV_TABS: { tab: DashboardTab; label: string }[] = [
  { tab: 'overview', label: 'Overview' },
  { tab: 'scanner', label: 'Scanner' },
  { tab: 'meal-planner', label: 'Meal Plan' },
  { tab: 'food-diary', label: 'Diary' },
  { tab: 'water-tracker', label: 'Water' },
  { tab: 'weekly-report', label: 'Weekly' },
];

export function Navbar({
  activeTab,
  onSelectTab,
  onUploadClick,
  onOpenVoiceAssistant,
  onShowToast,
  userDisplayName,
  userEmail,
  userPhotoUrl,
  onOpenProfile,
  onLogout,
}: NavbarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const firstName = userDisplayName.split(/\s+/)[0] || 'Account';

  return (
    <header className="sticky top-0 z-40 border-b border-[#EEDCE0] bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-3 sm:px-6 lg:px-8">
        {/* Zone 1: Brand wordmark */}
        <button
          type="button"
          onClick={() => {
            onSelectTab('overview');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className="inline-flex items-center gap-2 text-base font-bold tracking-tight text-[#241118] whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-700 rounded-md cursor-pointer"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#BE123C] text-white">
            <Heart className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
          </span>
          <span className="font-display">RosoFood AI</span>
        </button>

        {/* Zone 2: Navigation links */}
        <nav
          aria-label="Primary navigation"
          className="hidden lg:flex items-center gap-4 text-sm font-medium text-[#644A52]"
        >
          {NAV_TABS.map((item) => {
            const isActive = activeTab === item.tab;
            return (
              <button
                key={item.tab}
                type="button"
                onClick={() => onSelectTab(item.tab)}
                className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  isActive
                    ? 'font-semibold text-[#BE123C] underline underline-offset-4 decoration-[#BE123C]'
                    : 'hover:text-[#241118] hover:underline underline-offset-4 decoration-rose-700/50'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Primary action + Profile + mobile menu */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onOpenVoiceAssistant}
            className="hidden sm:inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-[#E5CFD4] bg-[#FFF8F9] px-2.5 py-1.5 text-xs font-semibold text-[#BE123C] transition-colors duration-150 hover:bg-[#FDF2F4] whitespace-nowrap shrink-0 cursor-pointer"
          >
            <PhoneCall className="h-3.5 w-3.5" aria-hidden="true" />
            AI Diet Call
          </button>

          <button
            type="button"
            onClick={onUploadClick}
            className="min-h-[38px] rounded-lg bg-[#BE123C] px-3 py-1.5 text-xs font-semibold text-white transition-colors duration-150 hover:bg-[#9F1239] whitespace-nowrap shrink-0 cursor-pointer sm:text-sm sm:px-3.5"
          >
            Scan Meal
          </button>

          <button
            type="button"
            onClick={onOpenProfile}
            title={`${userDisplayName} (${userEmail})`}
            aria-label="Open profile and account settings"
            className="inline-flex min-h-[38px] max-w-[140px] items-center gap-2 rounded-lg border border-[#E5CFD4] bg-[#FFF8F9] px-2 py-1 text-xs font-semibold text-[#241118] transition-colors hover:bg-[#FDF2F4] cursor-pointer"
          >
            {userPhotoUrl ? (
              <img
                src={userPhotoUrl}
                alt={userDisplayName}
                referrerPolicy="no-referrer"
                className="h-6 w-6 shrink-0 rounded-full object-cover"
              />
            ) : (
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#BE123C] text-[11px] font-bold text-white">
                {firstName.slice(0, 1).toUpperCase()}
              </span>
            )}
            <span className="hidden truncate sm:inline">{firstName}</span>
          </button>

          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-expanded={mobileMenuOpen}
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open navigation menu'}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#EEDCE0] text-[#241118] hover:bg-[#FDF3F5] lg:hidden cursor-pointer"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile navigation drawer */}
      {mobileMenuOpen && (
        <nav
          aria-label="Mobile navigation"
          className="border-t border-[#EEDCE0] bg-white px-4 py-3 lg:hidden"
        >
          <div className="flex flex-col space-y-1">
            {NAV_TABS.map((item) => (
              <button
                key={item.tab}
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  onSelectTab(item.tab);
                }}
                className={`flex min-h-[44px] items-center rounded-lg px-3 text-left text-sm font-medium cursor-pointer ${
                  activeTab === item.tab
                    ? 'bg-[#FDF2F4] font-semibold text-[#BE123C]'
                    : 'text-[#241118] hover:bg-[#FDF3F5]'
                }`}
              >
                {item.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                onOpenVoiceAssistant();
              }}
              className="flex min-h-[44px] items-center gap-2 rounded-lg px-3 text-left text-sm font-semibold text-[#BE123C] hover:bg-[#FDF3F5] cursor-pointer"
            >
              <PhoneCall className="h-4 w-4 text-[#BE123C]" aria-hidden="true" />
              Talk to AI Diet Assistant
            </button>
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                onOpenProfile();
              }}
              className="flex min-h-[44px] items-center gap-2 rounded-lg px-3 text-left text-sm font-medium text-[#241118] hover:bg-[#FDF3F5] cursor-pointer"
            >
              <UserIcon className="h-4 w-4 text-[#BE123C]" aria-hidden="true" />
              Profile ({userEmail})
            </button>
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                onLogout();
              }}
              className="flex min-h-[44px] items-center gap-2 rounded-lg px-3 text-left text-sm font-medium text-red-700 hover:bg-red-50 cursor-pointer"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              Sign Out
            </button>
            <div className="pt-2">
              <PWAInstallButton variant="drawer" onInstalledToast={onShowToast} />
            </div>
          </div>
        </nav>
      )}
    </header>
  );
}
