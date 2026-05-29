import { useState } from 'react'
import { NavLink } from 'react-router-dom'

const NAV_LINKS = [
  { to: '/', label: 'Public' },
  { to: '/responder', label: 'Responder' },
  { to: '/earthquakes', label: 'Earthquakes' },
  { to: '/safe-havens', label: 'Safe Havens' },
  { to: '/about', label: 'About' },
]

export function TopNav() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-[#e2e8f0] flex-shrink-0">
      <div className="flex items-center justify-between px-4 h-12">
        {/* Wordmark */}
        <NavLink to="/" className="flex items-center gap-2.5 no-underline">
          <svg
            width="28"
            height="28"
            viewBox="0 0 28 28"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path
              d="M14 2L4 7V14C4 19.5 8.4 24.7 14 26C19.6 24.7 24 19.5 24 14V7L14 2Z"
              fill="#1e3a5f"
            />
            <path
              d="M11 13.5L13 15.5L17 11.5"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="square"
              strokeLinejoin="miter"
            />
          </svg>
          <span
            className="text-[#1e3a5f] font-black tracking-[0.12em] text-base uppercase"
            style={{ fontFamily: 'Inter, sans-serif', letterSpacing: '0.14em' }}
          >
            ASHE
          </span>
        </NavLink>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-0">
          {NAV_LINKS.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                [
                  'px-4 py-3 text-sm font-medium tracking-wide uppercase transition-colors no-underline',
                  isActive
                    ? 'text-[#2563eb] border-b-2 border-[#2563eb]'
                    : 'text-[#64748b] hover:text-[#0f172a] border-b-2 border-transparent',
                ].join(' ')
              }
              style={{ letterSpacing: '0.04em' }}
            >
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Mobile hamburger */}
        <button
          className="md:hidden p-2 text-[#64748b] hover:text-[#0f172a]"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          {menuOpen ? (
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <path d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="2" strokeLinecap="square" fill="none" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <nav className="md:hidden border-t border-[#e2e8f0] bg-white">
          {NAV_LINKS.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              onClick={() => setMenuOpen(false)}
              className={({ isActive }) =>
                [
                  'block px-4 py-3 text-sm font-medium uppercase tracking-wide no-underline border-l-4',
                  isActive
                    ? 'text-[#2563eb] border-[#2563eb] bg-[#eff6ff]'
                    : 'text-[#64748b] border-transparent hover:text-[#0f172a] hover:bg-[#f8fafc]',
                ].join(' ')
              }
              style={{ letterSpacing: '0.04em' }}
            >
              {label}
            </NavLink>
          ))}
        </nav>
      )}
    </header>
  )
}
