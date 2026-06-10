import { useState } from "react";
import { motion } from "framer-motion";
import { useGameStore } from "../store";

export function OnboardingScreen() {
  const [input, setInput] = useState("");
  const [focused, setFocused] = useState(false);
  const setHandle = useGameStore(s => s.setHandle);

  const submit = () => {
    const clean = input.trim().replace(/[^a-zA-Z0-9_]/g, "").slice(0, 20);
    if (clean.length < 2) return;
    setHandle(clean);
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6"
      style={{ background: 'var(--bg)', gap: '48px' }}
    >
      {/* System tag */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        style={{
          position: 'absolute',
          top: '28px',
          fontFamily: 'var(--font-mono)',
          fontSize: '10px',
          color: 'var(--dim)',
          letterSpacing: '0.2em',
        }}
      >
        CLICKTOK SYSTEM v1.0 — CREATOR MODULE
      </motion.div>

      {/* Wordmark */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}
      >
        <h1
          className="chroma"
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(72px, 20vw, 100px)',
            lineHeight: 0.95,
            letterSpacing: '0.03em',
            color: 'var(--text)',
            margin: 0,
          }}
        >
          CLICKTOK
        </h1>
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '11px',
          color: 'var(--dim)',
          letterSpacing: '0.28em',
        }}>
          BECOME THE ALGORITHM
        </div>
      </motion.div>

      {/* Input form */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
        style={{ width: '100%', maxWidth: '320px', display: 'flex', flexDirection: 'column', gap: '20px' }}
      >
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '10px',
          color: 'var(--dim)',
          letterSpacing: '0.2em',
        }}>
          ENTER CREATOR HANDLE
        </div>

        {/* Terminal-style input */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            borderBottom: `2px solid ${focused ? 'var(--red)' : 'var(--dim)'}`,
            paddingBottom: '10px',
            transition: 'border-color 0.2s',
          }}
        >
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '20px',
            color: 'var(--red)',
            lineHeight: 1,
          }}>@</span>
          <input
            autoFocus
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submit()}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            maxLength={20}
            placeholder="your_handle"
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              fontFamily: 'var(--font-mono)',
              fontSize: '22px',
              color: 'var(--text)',
              caretColor: 'var(--red)',
            }}
          />
        </div>

        {/* Launch button */}
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={submit}
          style={{
            width: '100%',
            padding: '16px',
            fontFamily: 'var(--font-display)',
            fontSize: '22px',
            letterSpacing: '0.12em',
            color: '#000',
            background: 'var(--red)',
            border: 'none',
            cursor: 'pointer',
            boxShadow: '0 0 32px rgba(255,31,75,0.35)',
          }}
        >
          LAUNCH CHANNEL
        </motion.button>

        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '10px',
          color: 'var(--dim)',
          textAlign: 'center',
          letterSpacing: '0.08em',
        }}>
          MIN 2 CHARS — ALPHANUMERIC + UNDERSCORE
        </div>
      </motion.div>

      {/* Bottom rule */}
      <motion.div
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ delay: 0.45, duration: 0.9 }}
        style={{
          position: 'absolute',
          bottom: '28px',
          left: '32px',
          right: '32px',
          height: '1px',
          background: 'linear-gradient(90deg, transparent, var(--dim), transparent)',
        }}
      />
    </div>
  );
}
