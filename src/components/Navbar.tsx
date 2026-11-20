import { useState } from 'react';
import { Heart, Menu, X } from 'lucide-react';
import { PWAInstallButton } from './PWAInstallButton';

interface NavbarProps {
  onUploadClick: () => void;
  onShowToast?: (message: string) => void;
}

const NAV_LINKS = [
  { href: '#analyzer', label: 'Scanner' },
  { href: '#food-directory', label: 'Foods & Fruits' },
  { href: '#results', label: 'Nutrition' },
  { href: '#daily-tracker', label: 'Food Diary' },
  { href: '#faq', label: 'FAQ' },
];

export function Navbar({ onUploadClick, onShowToast }: NavbarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-[#EEDCE0] bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-8 px-4 sm:px-6 lg:px-8">
        {/* Zone 1: Single-element brand wordmark */}
        <a
          href="#top"
          className="inline-flex items-center gap-2.5 text-lg font-bold tracking-tight text-[#241118] whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-700 rounded-md"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#BE123C] text-white">
            <Heart className="h-4 w-4 fill-current" aria-hidden="true" />
          </span>
          <span className="font-display">RosoFood AI</span>
        </a>

        {/* Zone 2: Concise single-line navigation links */}
        <nav
          aria-label="Primary navigation"
          className="hidden md:flex items-center gap-6 text-sm font-medium text-[#644A52]"
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

        {/* Zone 3: Single primary action (+ mobile menu toggle on small screens) */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onUploadClick}
            className="min-h-[40px] rounded-lg bg-[#BE123C] px-4 py-2 text-sm font-semibold text-white transition-colors duration-150 hover:bg-[#9F1239] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-700 focus-visible:ring-offset-2 whitespace-nowrap shrink-0 cursor-pointer"
          >
            Scan Meal
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
            <div className="pt-2">
              <PWAInstallButton variant="drawer" onInstalledToast={onShowToast} />
            </div>
          </div>
        </nav>
      )}
    </header>
  );
}
