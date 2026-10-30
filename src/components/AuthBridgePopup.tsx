import React, { useEffect, useState } from 'react';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth } from '../firebase/config';
import { XongleLogo } from '../xongle/XongleLogo';
import { ShieldCheck, Loader2, AlertCircle } from 'lucide-react';

const ALLOWED_RETURN_ORIGINS = [
  'https://xongle.xyz',
  'https://www.xongle.xyz',
  'https://xongle.ai.studio',
  'https://xonomia-729971330198.asia-southeast1.run.app',
  'http://localhost:3000',
];

function isAllowedOrigin(origin: string): boolean {
  if (!origin) return false;
  if (ALLOWED_RETURN_ORIGINS.includes(origin)) return true;
  try {
    const url = new URL(origin);
    return (
      url.hostname === 'xongle.xyz' ||
      url.hostname === 'www.xongle.xyz' ||
      url.hostname.endsWith('.run.app') ||
      url.hostname.endsWith('.ai.studio')
    );
  } catch {
    return false;
  }
}

export const AuthBridgePopup: React.FC = () => {
  const [status, setStatus] = useState<'ready' | 'signing_in' | 'completed' | 'error'>('ready');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
  const rawOrigin = params.get('origin') || 'https://xongle.xyz';
  const targetOrigin = isAllowedOrigin(rawOrigin) ? rawOrigin : 'https://xongle.xyz';
  const scopeMode = params.get('scope') === 'drive' ? 'drive' : 'basic';

  const startGoogleSignIn = async () => {
    setStatus('signing_in');
    setErrorMsg(null);
    try {
      const provider = new GoogleAuthProvider();
      if (scopeMode === 'drive') {
        provider.addScope('https://www.googleapis.com/auth/drive.file');
        provider.setCustomParameters({
          prompt: 'consent select_account',
          include_granted_scopes: 'true',
        });
      } else {
        provider.setCustomParameters({ prompt: 'select_account' });
      }

      const result = await signInWithPopup(auth, provider);
      const cred = GoogleAuthProvider.credentialFromResult(result);
      const idToken = cred?.idToken || null;
      const accessToken = scopeMode === 'drive' ? cred?.accessToken || null : null;

      if (window.opener && !window.opener.closed) {
        window.opener.postMessage(
          {
            type: 'XONGLE_AUTH_BRIDGE_SUCCESS',
            idToken,
            accessToken,
          },
          targetOrigin
        );
      }
      setStatus('completed');
      setTimeout(() => {
        window.close();
      }, 250);
    } catch (err: any) {
      if (err?.code === 'auth/popup-blocked') {
        setStatus('ready');
        setErrorMsg('Click the button below to open your Google account selector.');
      } else {
        setStatus('error');
        setErrorMsg(err?.message || 'Google sign-in could not be completed.');
      }
    }
  };

  useEffect(() => {
    void startGoogleSignIn();
  }, []);

  return (
    <div className="min-h-screen bg-[#0b0d11] text-white flex flex-col items-center justify-center p-6 font-sans">
      <div className="w-full max-w-sm bg-[#12151c] border border-neutral-800 rounded-2xl p-6 shadow-2xl text-center space-y-5">
        <div className="flex flex-col items-center gap-2">
          <XongleLogo size={44} />
          <h1 className="text-lg font-bold tracking-tight text-white">
            Sign in to Xongle.xyz
          </h1>
          <p className="text-xs text-neutral-400 leading-relaxed">
            Completing verified Google Authentication for{' '}
            <span className="font-mono text-neutral-200">{targetOrigin}</span>
          </p>
        </div>

        {status === 'signing_in' && (
          <div className="py-4 flex flex-col items-center gap-2.5 text-xs text-neutral-300">
            <Loader2 size={24} className="text-blue-400" />
            <span>Waiting for Google account selection...</span>
          </div>
        )}

        {status === 'completed' && (
          <div className="py-4 flex flex-col items-center gap-2 text-xs text-emerald-400 font-semibold">
            <ShieldCheck size={28} />
            <span>Signed in! Returning to Xongle.xyz...</span>
          </div>
        )}

        {errorMsg && (
          <div className="p-3 rounded-xl bg-amber-950/60 border border-amber-800/60 text-amber-200 text-xs flex items-start gap-2 text-left">
            <AlertCircle size={15} className="shrink-0 mt-0.5 text-amber-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        {(status === 'ready' || status === 'error' || status === 'signing_in') && (
          <button
            type="button"
            onClick={startGoogleSignIn}
            className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs sm:text-sm cursor-pointer shadow-lg shadow-blue-600/20"
          >
            Continue with Google
          </button>
        )}

        <button
          type="button"
          onClick={() => {
            if (window.opener && !window.opener.closed) {
              window.opener.postMessage(
                { type: 'XONGLE_AUTH_BRIDGE_ERROR', code: 'auth/popup-closed-by-user' },
                targetOrigin
              );
            }
            window.close();
          }}
          className="text-xs text-neutral-500 hover:text-neutral-300 cursor-pointer"
        >
          Cancel and close window
        </button>
      </div>
    </div>
  );
};
