import { useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { clearTokens, getCurrentUser } from '../lib/auth';

interface NavItem {
  label: string;
  to: string;
  end?: boolean;
  icon: React.ReactNode;
}

const mainItems: NavItem[] = [
  {
    label: 'Dashboard',
    to: '/admin',
    end: true,
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13h4v8H3zM10 8h4v13h-4zM17 3h4v18h-4z" />
      </svg>
    ),
  },
  {
    label: 'Customers',
    to: '/admin/customers',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
      </svg>
    ),
  },
  {
    label: 'Plans',
    to: '/admin/plans',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    ),
  },
  {
    label: 'Subscriptions',
    to: '/admin/subscriptions',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.288 15.038a5.25 5.25 0 0 1 7.424 0M5.106 11.856c3.807-3.808 9.98-3.808 13.788 0M1.924 8.674c5.565-5.565 14.587-5.565 20.152 0M12 20.5a.5.5 0 1 1 0-1 .5.5 0 0 1 0 1Z" />
      </svg>
    ),
  },
  {
    label: 'Payments',
    to: '/admin/payments',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z" />
      </svg>
    ),
  },
  {
    label: 'Messages',
    to: '/admin/messages',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
      </svg>
    ),
  },
];

const systemItems: NavItem[] = [
  {
    label: 'MikroTik',
    to: '/admin/mikrotik',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.288 15.038a5.25 5.25 0 0 1 7.424 0M5.106 11.856c3.807-3.808 9.98-3.808 13.788 0M1.924 8.674c5.565-5.565 14.587-5.565 20.152 0M12 18h.008v.008H12V18Z" />
      </svg>
    ),
  },
  {
    label: 'Reports',
    to: '/admin/reports',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v18h18M7 16v-4m4 4V8m4 8v-6m4 6v-2" />
      </svg>
    ),
  },
  {
    label: 'Staff',
    to: '/admin/staff',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
      </svg>
    ),
  },
  {
    label: 'Activity Logs',
    to: '/admin/activity-logs',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
      </svg>
    ),
  },
  {
    label: 'Settings',
    to: '/admin/settings',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
      </svg>
    ),
  },
];

const pageTitles: Record<string, string> = {
  '/admin': 'Dashboard',
  '/admin/customers': 'Customers',
  '/admin/plans': 'Plans',
  '/admin/subscriptions': 'Subscriptions',
  '/admin/payments': 'Payments',
  '/admin/messages': 'Messages',
  '/admin/mikrotik': 'MikroTik',
  '/admin/reports': 'Reports',
  '/admin/staff': 'Staff',
  '/admin/activity-logs': 'Activity Logs',
  '/admin/settings': 'Settings',
};

function NavSection({
  label,
  items,
  onItemClick,
}: {
  label: string;
  items: NavItem[];
  onItemClick?: () => void;
}) {
  return (
    <div>
      <p className="px-3 mb-3 font-heading text-[10px] font-semibold uppercase tracking-widest text-[#475569]">
        {label}
      </p>
      <div className="space-y-1">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onItemClick}
            className={({ isActive }) =>
              `group flex items-center gap-3 px-3 h-10 rounded-[10px] font-body text-[14px] transition-all duration-200 relative ${
                isActive
                  ? 'bg-[rgba(34,211,238,0.06)] text-secondary'
                  : 'text-[#64748b] hover:text-[#94a3b8] hover:bg-[rgba(255,255,255,0.02)]'
              }`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-secondary rounded-r-full" />
                )}
                {item.icon}
                <span>{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </div>
  );
}

export default function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const user = getCurrentUser();

  const handleLogout = () => {
    clearTokens();
    navigate('/login');
  };

  const currentPage =
    pageTitles[location.pathname] ||
    Object.entries(pageTitles).find(([path]) =>
      location.pathname.startsWith(path + '/')
    )?.[1] ||
    'Dashboard';

  const roleBadge = user?.role === 'admin' ? 'Admin' : 'Technician';
  const roleBadgeClass = user?.role === 'admin' ? 'badge-admin' : 'badge-technician';

  const userInitials = user?.name
    ? user.name
        .split(' ')
        .map((n: string) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : 'U';

  const sidebar = (
    <nav className="flex flex-col h-full">
      {/* Logo area */}
      <div className="p-5 flex items-center gap-3">
        <img
          src="/omji-logo.svg"
          alt="OMJI"
          className="w-9 h-9 rounded-full object-cover ring-1 ring-[rgba(34,211,238,0.1)]"
        />
        <div>
          <h1 className="font-heading text-[15px] font-bold text-text-primary leading-tight tracking-wide">
            OMJI
          </h1>
          <p className="font-body text-[11px] text-[#475569] leading-tight">
            Billing System
          </p>
        </div>
      </div>

      {/* Separator */}
      <div className="mx-4 h-px bg-[rgba(34,211,238,0.06)]" />

      {/* Nav sections */}
      <div className="flex-1 py-5 px-3 space-y-6 overflow-y-auto">
        <NavSection
          label="Main"
          items={mainItems}
          onItemClick={() => setSidebarOpen(false)}
        />
        <NavSection
          label="System"
          items={systemItems}
          onItemClick={() => setSidebarOpen(false)}
        />
      </div>

      {/* User info footer */}
      <div className="p-4 border-t border-[rgba(34,211,238,0.06)]">
        <div className="flex items-center gap-3 px-1 mb-3">
          <div className="w-8 h-8 rounded-full bg-[rgba(34,211,238,0.08)] border border-[rgba(34,211,238,0.12)] flex items-center justify-center">
            <span className="font-heading text-[11px] font-bold text-secondary tracking-wide">
              {userInitials}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-body text-[13px] text-text-primary truncate leading-tight">
              {user?.name || 'User'}
            </p>
            <span className={`badge ${roleBadgeClass} mt-1`}>
              {roleBadge}
            </span>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 w-full px-3 py-2.5 rounded-[10px] font-body text-[13px] text-[#64748b] hover:text-destructive hover:bg-[rgba(239,68,68,0.06)] transition-all duration-200 cursor-pointer"
        >
          <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
          </svg>
          Logout
        </button>
      </div>
    </nav>
  );

  return (
    <div className="flex h-screen bg-bg-deep">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-[260px] bg-[#060a13] border-r border-[rgba(34,211,238,0.06)] transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:z-auto ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {sidebar}
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar - mobile */}
        <header className="flex items-center h-14 px-4 border-b border-[rgba(34,211,238,0.06)] bg-[#060a13] lg:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1.5 rounded-lg text-[#64748b] hover:text-text-primary hover:bg-[rgba(255,255,255,0.04)] cursor-pointer"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>
          <div className="flex items-center gap-2 ml-3">
            <img src="/omji-logo.svg" alt="OMJI" className="w-7 h-7 rounded-full object-cover" />
            <span className="font-heading text-[14px] font-bold text-text-primary tracking-wide">
              OMJI
            </span>
          </div>
        </header>

        {/* Desktop breadcrumb bar */}
        <header className="hidden lg:flex items-center h-14 px-8 border-b border-[rgba(34,211,238,0.06)] bg-[rgba(10,17,32,0.5)] backdrop-blur-md">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-body text-[#475569]">Admin</span>
            <svg className="w-3.5 h-3.5 text-[#334155]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
            </svg>
            <span className="font-body text-text-primary font-medium">{currentPage}</span>
          </div>
        </header>

        {/* Content area */}
        <main className="flex-1 overflow-y-auto bg-bg-surface p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
