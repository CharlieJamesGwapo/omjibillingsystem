import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { clearTokens } from '../lib/auth';

const navLinks = [
  { label: 'My Subscription', to: '/portal', end: true },
  { label: 'My Payments', to: '/portal/payments' },
  { label: 'Submit Payment', to: '/portal/submit-payment' },
];

export default function CustomerLayout() {
  const navigate = useNavigate();

  const handleLogout = () => {
    clearTokens();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-bg-surface">
      {/* Sticky header */}
      <header className="sticky top-0 z-30 h-16 bg-[rgba(6,10,19,0.9)] backdrop-blur-xl border-b border-[rgba(34,211,238,0.06)]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-full">
          <div className="flex items-center justify-between h-full">
            {/* Branding */}
            <div className="flex items-center gap-3 shrink-0">
              <img
                src="/omji-logo.svg"
                alt="OMJI"
                className="w-9 h-9 rounded-full object-cover ring-1 ring-[rgba(34,211,238,0.1)]"
              />
              <div>
                <h1 className="font-heading text-[15px] font-bold text-text-primary leading-tight tracking-wide">
                  OMJI
                </h1>
                <p className="font-body text-[11px] text-[#475569] leading-tight hidden sm:block">
                  Customer Portal
                </p>
              </div>
            </div>

            {/* Desktop nav tabs */}
            <nav className="hidden sm:flex items-center gap-1">
              {navLinks.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  end={link.end}
                  className={({ isActive }) =>
                    `relative px-4 py-2 font-heading text-[13px] font-semibold uppercase tracking-wider transition-all duration-200 ${
                      isActive
                        ? 'text-secondary'
                        : 'text-[#64748b] hover:text-[#94a3b8]'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      {link.label}
                      {isActive && (
                        <div className="absolute bottom-0 left-3 right-3 h-[2px] bg-secondary rounded-full" />
                      )}
                    </>
                  )}
                </NavLink>
              ))}
            </nav>

            {/* Logout button */}
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-3 py-2 rounded-[10px] font-heading text-[12px] font-semibold uppercase tracking-wider text-[#64748b] hover:text-destructive hover:bg-[rgba(239,68,68,0.06)] transition-all duration-200 cursor-pointer shrink-0"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9"
                />
              </svg>
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>

        {/* Mobile nav tabs - scrollable */}
        <div className="sm:hidden border-t border-[rgba(34,211,238,0.04)] bg-[rgba(6,10,19,0.95)]">
          <nav className="flex items-center gap-0 px-4 overflow-x-auto scrollbar-none">
            {navLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                className={({ isActive }) =>
                  `relative shrink-0 px-4 py-3 font-heading text-[12px] font-semibold uppercase tracking-wider whitespace-nowrap transition-all duration-200 ${
                    isActive
                      ? 'text-secondary'
                      : 'text-[#64748b] hover:text-[#94a3b8]'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    {link.label}
                    {isActive && (
                      <div className="absolute bottom-0 left-3 right-3 h-[2px] bg-secondary rounded-full" />
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
