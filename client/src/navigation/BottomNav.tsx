import type { CSSProperties, ReactElement } from "react";
import { motion } from "framer-motion";
import { useGameStore } from "../store";

export function BottomNav() {
  const activeTab = useGameStore(s => s.activeTab);
  const setTab = useGameStore(s => s.setTab);
  const setSheet = useGameStore(s => s.setSheet);

  return (
    <nav
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-around',
        padding: '6px 4px calc(6px + env(safe-area-inset-bottom))',
        borderTop: '1px solid var(--dim)',
        background: 'var(--bg2)',
        flexShrink: 0,
      }}
    >
      <NavButton
        active={activeTab === 'home'}
        label="Home"
        onClick={() => setTab('home')}
        icon={HomeIcon}
      />
      <NavButton
        active={activeTab === 'discover'}
        label="Discover"
        onClick={() => setTab('discover')}
        icon={DiscoverIcon}
      />

      {/* Center "+" — opens the Create sheet, doesn't change the active tab */}
      <motion.button
        onClick={() => setSheet('create')}
        aria-label="Create"
        whileHover={{ scale: 1.12, y: -2 }}
        whileTap={{ scale: 0.88 }}
        transition={{ type: "spring", stiffness: 520, damping: 22 }}
        style={createButtonStyle}
      >
        <CreateIcon />
      </motion.button>

      <NavButton
        active={activeTab === 'inbox'}
        label="Inbox"
        onClick={() => setTab('inbox')}
        icon={InboxIcon}
      />
      <NavButton
        active={activeTab === 'profile'}
        label="Profile"
        onClick={() => setTab('profile')}
        icon={ProfileIcon}
      />
    </nav>
  );
}

function NavButton({
  active,
  label,
  onClick,
  icon: Icon,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  icon: (props: { color: string }) => ReactElement;
}) {
  const color = active ? 'var(--text)' : 'var(--dim)';
  return (
    <motion.button
      onClick={onClick}
      aria-label={label}
      whileHover={{ scale: 1.1, y: -2 }}
      whileTap={{ scale: 0.88 }}
      transition={{ type: "spring", stiffness: 520, damping: 22 }}
      style={navButtonStyle}
    >
      <Icon color={color} />
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.08em', color }}>
        {label}
      </span>
    </motion.button>
  );
}

const navButtonStyle: CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '4px',
  padding: '6px 4px',
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
};

const createButtonStyle: CSSProperties = {
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 0,
  marginTop: '-6px',
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
};

const ICON_PROPS = {
  width: 22,
  height: 22,
  viewBox: '0 0 24 24',
  fill: 'none',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

function HomeIcon({ color }: { color: string }) {
  return (
    <svg {...ICON_PROPS} stroke={color}>
      <path d="M4 11.5 12 4l8 7.5" />
      <path d="M5.5 10v9a1 1 0 0 0 1 1h4v-5h3v5h4a1 1 0 0 0 1-1v-9" />
    </svg>
  );
}

function DiscoverIcon({ color }: { color: string }) {
  return (
    <svg {...ICON_PROPS} stroke={color}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M20 20 15.5 15.5" />
    </svg>
  );
}

function InboxIcon({ color }: { color: string }) {
  return (
    <svg {...ICON_PROPS} stroke={color}>
      <path d="M12 3a5 5 0 0 0-5 5c0 5-2 6-2 7h14s-2-1-2-7a5 5 0 0 0-5-5Z" />
      <path d="M10 19a2 2 0 0 0 4 0" />
    </svg>
  );
}

function ProfileIcon({ color }: { color: string }) {
  return (
    <svg {...ICON_PROPS} stroke={color}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6" />
    </svg>
  );
}

// TikTok-style "+" — black tile with chromatic red/cyan tiles offset behind it.
function CreateIcon() {
  return (
    <div style={{ position: 'relative', width: '46px', height: '32px' }}>
      <div style={{ position: 'absolute', left: '4px', top: 0, width: '38px', height: '32px', background: 'var(--cyan)', borderRadius: '8px' }} />
      <div style={{ position: 'absolute', right: '4px', top: 0, width: '38px', height: '32px', background: 'var(--red)', borderRadius: '8px' }} />
      <div style={{ position: 'absolute', left: '4px', top: 0, width: '38px', height: '32px', background: 'var(--text)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#08060d" strokeWidth="3" strokeLinecap="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </div>
    </div>
  );
}
