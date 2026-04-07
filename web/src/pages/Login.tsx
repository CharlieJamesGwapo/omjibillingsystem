import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { saveTokens, getCurrentUser } from '../lib/auth';

export default function Login() {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [phoneFocused, setPhoneFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(t);
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { data } = await api.post('/auth/login', { phone, password });
      saveTokens(data.tokens.access_token, data.tokens.refresh_token);
      const user = getCurrentUser();
      if (user?.role === 'admin' || user?.role === 'technician') {
        navigate('/admin', { replace: true });
      } else {
        navigate('/portal', { replace: true });
      }
    } catch (err: any) {
      const msg =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        'Invalid credentials. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;500;600;700&family=Outfit:wght@300;400;500;600;700&display=swap');

        .login-root {
          --cyan: #22d3ee;
          --cyan-dim: #0e7490;
          --blue: #3b82f6;
          --navy: #0a0e1a;
          --navy-light: #0f1729;
          --navy-card: #111b2e;
          --slate: #1e293b;
          --border: rgba(34, 211, 238, 0.08);
          --glow: rgba(34, 211, 238, 0.15);
          font-family: 'Outfit', sans-serif;
        }

        @keyframes scanline {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(100vh); }
        }
        @keyframes pulse-ring {
          0%, 100% { transform: scale(1); opacity: 0.4; }
          50% { transform: scale(1.08); opacity: 0.15; }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-12px); }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(24px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideRight {
          from { opacity: 0; transform: translateX(-30px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes typing {
          from { width: 0; }
          to { width: 100%; }
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        @keyframes hexFloat {
          0%, 100% { transform: rotate(0deg) translateY(0); opacity: 0.03; }
          50% { transform: rotate(3deg) translateY(-8px); opacity: 0.06; }
        }
        @keyframes glowPulse {
          0%, 100% { box-shadow: 0 0 20px rgba(34,211,238,0.1), 0 0 60px rgba(34,211,238,0.05); }
          50% { box-shadow: 0 0 30px rgba(34,211,238,0.2), 0 0 80px rgba(34,211,238,0.08); }
        }

        .mascot-float { animation: float 6s ease-in-out infinite; }
        .ring-pulse { animation: pulse-ring 3s ease-in-out infinite; }
        .shimmer-btn {
          background-size: 200% 100%;
          animation: shimmer 3s linear infinite;
        }

        .hex-pattern {
          animation: hexFloat 8s ease-in-out infinite;
          background-image: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 5L52 17.5V42.5L30 55L8 42.5V17.5L30 5Z' fill='none' stroke='rgba(34,211,238,0.15)' stroke-width='0.5'/%3E%3C/svg%3E");
        }

        .input-glow:focus-within {
          box-shadow: 0 0 0 1px var(--cyan), 0 0 20px rgba(34,211,238,0.08), inset 0 0 20px rgba(34,211,238,0.03);
        }

        .login-root input::placeholder {
          color: #64748b !important;
          opacity: 1;
        }

        .login-card {
          animation: glowPulse 4s ease-in-out infinite;
          background: linear-gradient(135deg, rgba(17,27,46,0.9) 0%, rgba(15,23,41,0.95) 100%);
          backdrop-filter: blur(20px);
        }
      `}</style>

      <div className="login-root min-h-screen flex relative overflow-hidden" style={{ background: 'var(--navy)' }}>

        {/* === BACKGROUND ATMOSPHERE === */}
        {/* Scan line */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-10 opacity-[0.03]">
          <div className="absolute left-0 right-0 h-[2px] bg-[var(--cyan)]" style={{ animation: 'scanline 8s linear infinite' }} />
        </div>

        {/* Hex pattern overlay */}
        <div className="absolute inset-0 hex-pattern opacity-[0.03] pointer-events-none" />

        {/* Gradient orbs */}
        <div className="absolute top-[-15%] right-[10%] w-[500px] h-[500px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(34,211,238,0.06) 0%, transparent 70%)' }} />
        <div className="absolute bottom-[-20%] left-[5%] w-[600px] h-[600px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.05) 0%, transparent 70%)' }} />
        <div className="absolute top-[50%] left-[45%] w-[300px] h-[300px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(34,211,238,0.03) 0%, transparent 70%)' }} />

        {/* Noise grain */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.015]" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E")` }} />

        {/* === LEFT PANEL — MASCOT & BRAND === */}
        <div className="hidden lg:flex lg:w-[52%] relative items-center justify-center">
          {/* Panel gradient */}
          <div className="absolute inset-0" style={{ background: 'linear-gradient(160deg, var(--navy-light) 0%, var(--navy) 40%, rgba(17,27,46,0.6) 100%)' }} />

          {/* Fine grid lines */}
          <div className="absolute inset-0 opacity-[0.025]" style={{
            backgroundImage: 'linear-gradient(rgba(34,211,238,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,0.3) 1px, transparent 1px)',
            backgroundSize: '100px 100px',
          }} />

          {/* Vertical separator */}
          <div className="absolute right-0 top-[10%] bottom-[10%] w-px" style={{ background: 'linear-gradient(to bottom, transparent, var(--border), rgba(34,211,238,0.12), var(--border), transparent)' }} />

          {/* Content */}
          <div className="relative z-10 flex flex-col items-center px-12" style={{
            animation: mounted ? 'slideRight 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards' : 'none',
            opacity: mounted ? 1 : 0,
          }}>
            {/* Mascot with rings */}
            <div className="relative mb-12">
              {/* Outer glow ring */}
              <div className="absolute -inset-6 rounded-full ring-pulse" style={{ border: '1px solid rgba(34,211,238,0.08)' }} />
              <div className="absolute -inset-12 rounded-full ring-pulse" style={{ border: '1px solid rgba(34,211,238,0.04)', animationDelay: '1s' }} />

              {/* Cyan halo */}
              <div className="absolute -inset-4 rounded-full" style={{ background: 'radial-gradient(circle, rgba(34,211,238,0.12) 0%, transparent 70%)' }} />

              {/* Logo container */}
              <div className="mascot-float relative">
                <div className="w-56 h-56 rounded-full overflow-hidden" style={{
                  border: '2px solid rgba(34,211,238,0.25)',
                  boxShadow: '0 0 40px rgba(34,211,238,0.12), 0 0 80px rgba(34,211,238,0.05), inset 0 0 30px rgba(0,0,0,0.3)',
                }}>
                  <img src="/lego.jpeg" alt="OMJI" className="w-full h-full object-cover" />
                </div>

                {/* Status dot */}
                <div className="absolute -bottom-1 right-6 flex items-center gap-1.5 px-3 py-1 rounded-full" style={{ background: 'var(--navy-card)', border: '1px solid rgba(34,211,238,0.15)' }}>
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-[10px] font-medium tracking-wider uppercase" style={{ color: '#34d399' }}>ONLINE</span>
                </div>
              </div>
            </div>

            {/* Brand text */}
            <div className="text-center">
              <h1 className="text-5xl font-bold tracking-tight mb-1" style={{ fontFamily: "'Rajdhani', sans-serif", color: '#ffffff', letterSpacing: '0.08em' }}>
                OMJI
              </h1>
              <div className="flex items-center gap-3 justify-center mb-6">
                <div className="h-px w-8" style={{ background: 'linear-gradient(to right, transparent, var(--cyan-dim))' }} />
                <p className="text-sm font-medium tracking-[0.2em] uppercase" style={{ color: 'var(--cyan)', fontFamily: "'Rajdhani', sans-serif" }}>
                  Internet Access & Billing
                </p>
                <div className="h-px w-8" style={{ background: 'linear-gradient(to left, transparent, var(--cyan-dim))' }} />
              </div>
            </div>

            {/* Stats row */}
            <div className="flex items-center gap-6 mt-4">
              {[
                { label: 'UPTIME', value: '99.9%', icon: 'M5 12h14' },
                { label: 'CLIENTS', value: '500+', icon: 'M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z' },
                { label: 'SPEED', value: '1Gbps', icon: 'M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z' },
              ].map((stat) => (
                <div key={stat.label} className="text-center px-4 py-3 rounded-xl" style={{ background: 'rgba(17,27,46,0.6)', border: '1px solid var(--border)' }}>
                  <div className="flex items-center justify-center gap-1.5 mb-1">
                    <svg className="w-3.5 h-3.5" style={{ color: 'var(--cyan)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d={stat.icon} />
                    </svg>
                    <span className="text-[10px] font-semibold tracking-[0.15em]" style={{ color: '#94a3b8', fontFamily: "'Rajdhani', sans-serif" }}>{stat.label}</span>
                  </div>
                  <span className="text-lg font-bold" style={{ color: '#ffffff', fontFamily: "'Rajdhani', sans-serif" }}>{stat.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* === RIGHT PANEL — LOGIN FORM === */}
        <div className="flex-1 flex items-center justify-center px-6 sm:px-10 py-12 relative z-20">
          <div className="w-full max-w-[420px]" style={{
            animation: mounted ? 'fadeUp 0.7s cubic-bezier(0.16, 1, 0.3, 1) 0.2s forwards' : 'none',
            opacity: mounted ? 1 : 0,
          }}>

            {/* Mobile mascot */}
            <div className="lg:hidden text-center mb-10">
              <div className="relative inline-block mb-5">
                <div className="absolute -inset-3 rounded-full" style={{ background: 'radial-gradient(circle, rgba(34,211,238,0.1) 0%, transparent 70%)' }} />
                <div className="w-28 h-28 rounded-full overflow-hidden mx-auto mascot-float" style={{
                  border: '2px solid rgba(34,211,238,0.2)',
                  boxShadow: '0 0 30px rgba(34,211,238,0.1)',
                }}>
                  <img src="/lego.jpeg" alt="OMJI" className="w-full h-full object-cover" />
                </div>
              </div>
              <h1 className="text-3xl font-bold tracking-wider" style={{ fontFamily: "'Rajdhani', sans-serif", color: '#ffffff' }}>OMJI</h1>
              <p className="text-xs font-medium tracking-[0.2em] uppercase mt-1" style={{ color: 'var(--cyan)' }}>Internet Access & Billing</p>
            </div>

            {/* Login card */}
            <div className="login-card rounded-2xl p-8 sm:p-10" style={{ border: '1px solid var(--border)' }}>

              {/* Header */}
              <div className="mb-8">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-1 h-5 rounded-full" style={{ background: 'var(--cyan)' }} />
                  <span className="text-[11px] font-semibold tracking-[0.2em] uppercase" style={{ color: 'var(--cyan)', fontFamily: "'Rajdhani', sans-serif" }}>
                    Secure Login
                  </span>
                </div>
                <h2 className="text-2xl font-bold" style={{ color: '#f1f5f9', fontFamily: "'Outfit', sans-serif" }}>
                  Welcome back
                </h2>
                <p className="text-sm mt-1.5" style={{ color: '#94a3b8' }}>
                  Enter your credentials to access the dashboard
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Error */}
                {error && (
                  <div className="flex items-start gap-3 text-sm rounded-xl px-4 py-3" style={{
                    background: 'rgba(239,68,68,0.08)',
                    border: '1px solid rgba(239,68,68,0.15)',
                    color: '#f87171',
                    animation: 'fadeIn 0.2s ease-out',
                  }}>
                    <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9.303 3.376c.866 1.5-.217 3.374-1.948 3.374H4.645c-1.73 0-2.813-1.874-1.948-3.374L10.051 3.378c.866-1.5 3.032-1.5 3.898 0l8.354 14.498ZM12 15.75h.007v.008H12v-.008Z" />
                    </svg>
                    <span>{error}</span>
                  </div>
                )}

                {/* Phone */}
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase mb-2.5" style={{ color: '#94a3b8', fontFamily: "'Rajdhani', sans-serif" }}>
                    <svg className="w-3.5 h-3.5" style={{ color: phoneFocused ? 'var(--cyan)' : '#64748b' }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 0 0 6 3.75v16.5a2.25 2.25 0 0 0 2.25 2.25h7.5A2.25 2.25 0 0 0 18 20.25V3.75a2.25 2.25 0 0 0-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
                    </svg>
                    Phone Number
                  </label>
                  <div
                    className="input-glow relative rounded-xl transition-all duration-300"
                    style={{
                      background: 'rgba(15,23,41,0.8)',
                      border: phoneFocused ? '1px solid rgba(34,211,238,0.4)' : '1px solid var(--border)',
                    }}
                  >
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      onFocus={() => setPhoneFocused(true)}
                      onBlur={() => setPhoneFocused(false)}
                      required
                      placeholder="09xxxxxxxxx"
                      className="w-full bg-transparent px-4 py-3.5 text-sm outline-none"
                      style={{ color: '#f1f5f9', fontFamily: "'Outfit', sans-serif" }}
                    />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase mb-2.5" style={{ color: '#94a3b8', fontFamily: "'Rajdhani', sans-serif" }}>
                    <svg className="w-3.5 h-3.5" style={{ color: passwordFocused ? 'var(--cyan)' : '#64748b' }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                    </svg>
                    Password
                  </label>
                  <div
                    className="input-glow relative rounded-xl transition-all duration-300"
                    style={{
                      background: 'rgba(15,23,41,0.8)',
                      border: passwordFocused ? '1px solid rgba(34,211,238,0.4)' : '1px solid var(--border)',
                    }}
                  >
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onFocus={() => setPasswordFocused(true)}
                      onBlur={() => setPasswordFocused(false)}
                      required
                      placeholder="Enter your password"
                      className="w-full bg-transparent pl-4 pr-12 py-3.5 text-sm outline-none"
                      style={{ color: '#f1f5f9', fontFamily: "'Outfit', sans-serif" }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-4 flex items-center transition-colors cursor-pointer"
                      style={{ color: '#64748b' }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--cyan)')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(148,163,184,0.4)')}
                    >
                      {showPassword ? (
                        <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                        </svg>
                      ) : (
                        <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-3 text-sm font-semibold rounded-xl py-3.5 transition-all duration-300 cursor-pointer flex items-center justify-center gap-2.5 disabled:opacity-40 disabled:cursor-not-allowed group relative overflow-hidden"
                  style={{
                    background: loading ? 'rgba(34,211,238,0.15)' : 'linear-gradient(135deg, var(--cyan) 0%, var(--blue) 100%)',
                    color: '#fff',
                    boxShadow: loading ? 'none' : '0 4px 24px rgba(34,211,238,0.2), 0 0 0 1px rgba(34,211,238,0.1)',
                    fontFamily: "'Rajdhani', sans-serif",
                    letterSpacing: '0.08em',
                  }}
                  onMouseEnter={(e) => { if (!loading) e.currentTarget.style.boxShadow = '0 8px 32px rgba(34,211,238,0.3), 0 0 0 1px rgba(34,211,238,0.2)'; }}
                  onMouseLeave={(e) => { if (!loading) e.currentTarget.style.boxShadow = '0 4px 24px rgba(34,211,238,0.2), 0 0 0 1px rgba(34,211,238,0.1)'; }}
                >
                  {loading ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                        <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      <span>AUTHENTICATING...</span>
                    </>
                  ) : (
                    <>
                      <span>SIGN IN</span>
                      <svg className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                      </svg>
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Footer */}
            <div className="mt-8 text-center">
              <div className="flex items-center justify-center gap-6 mb-4">
                {['WiFi Mgmt', 'Auto Billing', 'MikroTik'].map((feature) => (
                  <div key={feature} className="flex items-center gap-1.5">
                    <div className="w-1 h-1 rounded-full" style={{ background: '#22d3ee' }} />
                    <span className="text-[10px] font-medium tracking-wider uppercase" style={{ color: '#64748b', fontFamily: "'Rajdhani', sans-serif" }}>
                      {feature}
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-[11px]" style={{ color: '#475569' }}>
                OMJI Internet Access & Billing System v1.0
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
