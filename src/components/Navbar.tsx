import { useState } from 'react';
import { Heart, LogOut, Menu, PhoneCall, User as UserIcon, X } from 'lucide-react';
import { PWAInstallButton } from './PWAInstallButton';

interface NavbarProps {
  onUploadClick: () => void;
  onOpenVoiceAssistant: () => void;
  onShowToast?: (message: string) => void;
  userDisplayName: string;
  userEmail: string;
  userPhotoUrl?: string;
  onOpenProfile: () => void;
  onLogout: () => void;
}

const NAV_LINKS = [
  { href: '#analyzer', label: 'Scanner' },
  { href: '#food-directory', label: 'Foods & Fruits' },
  { href: '#meal-planner', label: 'Meal Planner' },
  { href: '#water-tracker', label: 'Water' },
  { href: '#weekly-report', label: 'Weekly' },
  { href: '#results', label: 'Nutrition' },
  { href: '#daily-tracker', label: 'Food Diary' },
  { href: '#faq', label: 'FAQ' },
];

export function Navbar({
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
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        {/* Zone 1: Brand wordmark */}
        <a
          href="#top"
          className="inline-flex items-center gap-2.5 text-lg font-bold tracking-tight text-[#241118] whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-700 rounded-md"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#BE123C] text-white">
            <Heart className="h-4 w-4 fill-current" aria-hidden="true" />
          </span>
          <span className="font-display">RosoFood AI</span>
        </a>

        {/* Zone 2: Navigation links */}
        <nav
          aria-label="Primary navigation"
          className="hidden lg:flex items-center gap-3.5 xl:gap-5 text-sm font-medium text-[#644A52]"
        >
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="hover:text-[#241118] hover:underline underline-offset-4 decoration-rose-700/50 transition-colors whitespace-nowrap shrink-0"
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* Zone 3: Primary action + Profile + mobile menu */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onOpenVoiceAssistant}
            className="hidden sm:inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-[#E5CFD4] bg-[#FFF8F9] px-3 py-2 text-xs font-semibold text-[#BE123C] transition-colors duration-150 hover:bg-[#FDF2F4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-700 focus-visible:ring-offset-2 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <PhoneCall className="h-3.5 w-3.5" aria-hidden="true" />
            AI Diet Call
          </button>

          <button
            type="button"
            onClick={onUploadClick}
            className="min-h-[40px] rounded-lg bg-[#BE123C] px-3.5 py-2 text-sm font-semibold text-white transition-colors duration-150 hover:bg-[#9F1239] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-700 focus-visible:ring-offset-2 whitespace-nowrap shrink-0 cursor-pointer"
          >
            Scan Meal
          </button>

          <button
            type="button"
            onClick={onOpenProfile}
            title={`${userDisplayName} (${userEmail})`}
            aria-label="Open profile and account settings"
            className="inline-flex min-h-[40px] max-w-[155px] items-center gap-2 rounded-lg border border-[#E5CFD4] bg-[#FFF8F9] px-2.5 py-1.5 text-xs font-semibold text-[#241118] transition-colors hover:bg-[#FDF2F4] cursor-pointer"
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
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#EEDCE0] text-[#241118] hover:bg-[#FDF3F5] md:hidden cursor-pointer"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile navigation drawer */}
      {mobileMenuOpen && (
        <nav
          aria-label="Mobile navigation"
          className="border-t border-[#EEDCE0] bg-white px-4 py-3 md:hidden"
        >
          <div className="flex flex-col space-y-1">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className="flex min-h-[44px] items-center rounded-lg px-3 text-sm font-medium text-[#241118] hover:bg-[#FDF3F5]"
              >
                {link.label}
              </a>
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
