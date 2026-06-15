import { useEffect, useState } from "react";
import { useGameStore } from "../store";
import { supabase } from "../lib/supabase";
import { resetProgress } from "../hooks/useCloudSync";

const STATUS_COLOR: Record<string, string> = {
  offline: "var(--dim)",
  "signing-in": "var(--gold)",
  syncing: "var(--gold)",
  synced: "var(--cyan)",
  error: "var(--red)",
};

const STATUS_LABEL: Record<string, string> = {
  offline: "CLOUD SAVE OFFLINE",
  "signing-in": "SIGNING IN…",
  syncing: "SYNCING…",
  synced: "SYNCED",
  error: "SYNC ERROR",
};

export function CloudAccountPanel() {
  const cloudSyncStatus = useGameStore(s => s.cloudSyncStatus);
  const cloudIsAnonymous = useGameStore(s => s.cloudIsAnonymous);
  const cloudEmail = useGameStore(s => s.cloudEmail);

  const [email, setEmail] = useState("");
  const [linkMessage, setLinkMessage] = useState<string | null>(null);
  const [linking, setLinking] = useState(false);

  const linkEmail = async () => {
    if (!supabase || !email || linking) return;
    setLinking(true);
    setLinkMessage(null);
    const { error } = await supabase.auth.updateUser({ email });
    setLinking(false);
    setLinkMessage(error ? error.message : `Check ${email} for a confirmation link.`);
  };

  const [resetArmed, setResetArmed] = useState(false);
  const [resetting, setResetting] = useState(false);

  // Disarm the "tap again to confirm" state after a few seconds.
  useEffect(() => {
    if (!resetArmed) return;
    const timer = setTimeout(() => setResetArmed(false), 4000);
    return () => clearTimeout(timer);
  }, [resetArmed]);

  const handleReset = () => {
    if (resetting) return;
    if (!resetArmed) {
      setResetArmed(true);
      return;
    }
    setResetting(true);
    resetProgress();
  };

  return (
    <div style={{ width: '100%', maxWidth: '384px', padding: '0 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--dim)', letterSpacing: '0.2em' }}>
          ACCOUNT
        </span>
        <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.06)' }} />
      </div>

      {/* Sync status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{
          width: '7px', height: '7px', borderRadius: '50%',
          background: STATUS_COLOR[cloudSyncStatus],
          boxShadow: `0 0 6px ${STATUS_COLOR[cloudSyncStatus]}`,
          flexShrink: 0,
        }} />
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text)', letterSpacing: '0.12em' }}>
          {STATUS_LABEL[cloudSyncStatus]}
        </span>
      </div>

      {cloudSyncStatus === "offline" ? (
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--dim)', letterSpacing: '0.04em' }}>
          Progress is saved on this device only.
        </div>
      ) : !cloudIsAnonymous && cloudEmail ? (
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--dim)', letterSpacing: '0.04em' }}>
          Synced as {cloudEmail} — sign in with this email on another device to continue.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--dim)', letterSpacing: '0.04em' }}>
            Link an email to save your progress across devices.
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              style={{
                flex: 1,
                padding: '10px 12px',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.09)',
                color: 'var(--text)',
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                letterSpacing: '0.04em',
              }}
            />
            <button
              onClick={linkEmail}
              disabled={!email || linking}
              style={{
                padding: '10px 16px',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.09)',
                color: !email || linking ? 'var(--dim)' : 'var(--cyan)',
                fontFamily: 'var(--font-mono)',
                fontSize: '10px',
                letterSpacing: '0.14em',
                cursor: !email || linking ? 'default' : 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {linking ? "…" : "LINK EMAIL"}
            </button>
          </div>
          {linkMessage && (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--gold)', letterSpacing: '0.04em' }}>
              {linkMessage}
            </div>
          )}
        </div>
      )}

      {/* Playtesting: wipe local + cloud save, stay signed in */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '14px' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--dim)', letterSpacing: '0.2em' }}>
          DANGER ZONE
        </span>
        <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.06)' }} />
      </div>
      <button
        onClick={handleReset}
        disabled={resetting}
        style={{
          width: '100%',
          padding: '10px 16px',
          background: resetArmed ? 'rgba(255,71,87,0.12)' : 'rgba(255,255,255,0.03)',
          border: `1px solid ${resetArmed ? 'var(--red)' : 'rgba(255,255,255,0.09)'}`,
          color: resetting ? 'var(--dim)' : 'var(--red)',
          fontFamily: 'var(--font-mono)',
          fontSize: '10px',
          letterSpacing: '0.14em',
          cursor: resetting ? 'default' : 'pointer',
        }}
      >
        {resetting ? "ERASING…" : resetArmed ? "TAP AGAIN TO ERASE ALL PROGRESS" : "RESET PROGRESS"}
      </button>
    </div>
  );
}
