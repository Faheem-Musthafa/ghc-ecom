import React, { FormEvent, useState } from 'react';
import { Link, Redirect, useHistory } from 'react-router-dom';
import { IconArrowRight, IconCheckCircle, IconShield, IconShieldCheck } from '../components/Icons';
import SEOHead from '../components/SEOHead';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import { useDailyTheme } from '../hooks/useDailyTheme';
import { api, getCartIdentity, saveCartIdentity } from '../lib/api';

const AuthPage = () => {
    const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const { signedIn, sync } = useAuth();
    const cartContext = useCart();
    const history = useHistory();
    const theme = useDailyTheme();

    if (signedIn) return <Redirect to="/account" />;

    const submit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setLoading(true);
        setError('');
        setNotice('');
        const form = new FormData(event.currentTarget);
        try {
            if (mode === 'forgot') {
                await api.forgotPassword(String(form.get('email')));
                setNotice('Password reset instructions have been sent if the account exists.');
                return;
            }
            const guestItems = cartContext.cart?.items || [];
            const guestIdentity = getCartIdentity();
            const session =
                mode === 'login'
                    ? await api.login(String(form.get('email')), String(form.get('password')))
                    : await api.register(String(form.get('name')), String(form.get('email')), String(form.get('password')));
            if (!session) {
                setNotice('Check your email to confirm the account, then sign in.');
                return;
            }
            if (guestIdentity?.guestToken) {
                saveCartIdentity(null);
                const created = await api.createCart();
                saveCartIdentity({ cartId: created.cart.id });
                for (const item of guestItems) await api.setCartItem(created.cart.id, item.variantId, item.quantity);
            }
            sync();
            await cartContext.refreshCart();
            history.replace('/account');
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : 'Authentication failed.');
        } finally {
            setLoading(false);
        }
    };

    const fieldClass = 'field h-12 w-full text-xs placeholder:text-cream/30';

    return (
        <div className="min-h-screen bg-obsidian text-cream font-body flex flex-col justify-between">
            <SEOHead title="Sign In | Glockery Home Centre" />

            {/* Top Minimal Navigation Header */}
            <header className="flex h-20 items-center justify-between border-b border-line bg-obsidian px-6 sm:px-10 lg:px-12">
                <Link to="/" className="flex items-center gap-2.5 text-gold-300" aria-label="Glockery Home Centre">
                    <div className="grid size-9 place-items-center rounded-sm border border-gold-400 bg-obsidian text-gold-400 font-display font-bold text-xl">
                        G
                    </div>
                    <div className="leading-tight">
                        <span className="block font-display text-xl tracking-[0.14em] text-gold-300 font-bold">GLOCKERY</span>
                        <small className="block text-[8px] uppercase tracking-[0.35em] text-cream/50">Home Centre</small>
                    </div>
                </Link>

                <Link to="/" className="text-xs uppercase tracking-[0.2em] font-semibold text-cream/60 hover:text-gold-300 transition">
                    Return to shop
                </Link>
            </header>

            <main className="grid min-h-[calc(100vh-80px)] lg:grid-cols-12 flex-1">
                {/* Left Atmospheric Brand Frame */}
                <div className="relative hidden overflow-hidden lg:block lg:col-span-7 bg-carbon border-r border-gold-500/20">
                    <img
                        src={theme.story}
                        alt="Glockery tableware collection"
                        className="absolute inset-0 h-full w-full object-cover opacity-75"
                    />
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-obsidian/40 to-obsidian" />

                    <div className="absolute bottom-16 left-12 right-12 max-w-xl">
                        <span className="eyebrow mb-4 block">Your Glockery account</span>
                        <h1 className="font-display text-5xl font-semibold leading-[1.02] text-cream">
                            Your orders and details, in one place.
                        </h1>
                        <p className="mt-4 text-xs leading-relaxed text-cream/65">
                            Track orders, manage delivery addresses, access tax invoices, and store curated wishlist items.
                        </p>

                        <div className="mt-8 flex items-center gap-6 text-[11px] text-cream/55">
                            <span className="flex items-center gap-1.5"><IconShield size={16} className="text-gold-400 shrink-0" /> Secure session</span>
                        </div>
                    </div>
                </div>

                {/* Right Form Card Panel */}
                <div className="flex items-center justify-center px-6 py-12 sm:px-12 lg:col-span-5 bg-obsidian">
                    <div className="w-full max-w-md border border-line bg-carbon p-8 sm:p-10">
                        {/* Tab Switcher */}
                        <div className="mb-8 flex border-b border-gold-500/20">
                            {(['login', 'register'] as const).map((item) => (
                                <button
                                    key={item}
                                    onClick={() => {
                                        setMode(item);
                                        setError('');
                                        setNotice('');
                                    }}
                                    className={`flex-1 border-b-2 py-3 text-xs uppercase tracking-widest font-bold transition ${mode === item ? 'border-gold-400 text-gold-300' : 'border-transparent text-cream/40 hover:text-cream/70'}`}
                                >
                                    {item === 'login' ? 'Sign in' : 'Create account'}
                                </button>
                            ))}
                        </div>

                        <span className="eyebrow">
                            {mode === 'forgot' ? 'Account Recovery' : mode === 'login' ? 'Welcome Back' : 'Join Glockery'}
                        </span>
                        <h2 className="mt-2 font-display text-4xl font-semibold text-cream">
                            {mode === 'forgot' ? 'Reset your password.' : mode === 'login' ? 'Enter your account.' : 'Begin your collection.'}
                        </h2>

                        <form onSubmit={submit} className="mt-8 space-y-4">
                            {mode === 'register' && (
                                <label className="block">
                                    <span className="mb-1.5 block text-xs font-semibold text-cream/70">Full Name</span>
                                    <input className={fieldClass} name="name" autoComplete="name" placeholder="Aarav Sharma" required />
                                </label>
                            )}

                            <label className="block">
                                <span className="mb-1.5 block text-xs font-semibold text-cream/70">Email Address</span>
                                <input className={fieldClass} name="email" type="email" autoComplete="email" placeholder="aarav@example.com" required />
                            </label>

                            {mode !== 'forgot' && (
                                <label className="block">
                                    <span className="mb-1.5 block text-xs font-semibold text-cream/70">Password</span>
                                    <input
                                        className={fieldClass}
                                        name="password"
                                        type="password"
                                        autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                                        minLength={mode === 'login' ? 8 : 12}
                                        maxLength={128}
                                        required
                                    />
                                    <small className="mt-1.5 block text-[10px] text-cream/40">
                                        {mode === 'login' ? 'Enter your account password' : 'Minimum 12 characters required'}
                                    </small>
                                </label>
                            )}

                            {error && <p className="rounded-sm border border-red-500/30 bg-red-950/20 p-3 text-xs text-red-200">{error}</p>}
                            {notice && (
                                <div className="flex items-center gap-2 rounded-sm border border-gold-500/30 bg-gold-950/20 p-3 text-xs font-semibold text-gold-200">
                                    <IconCheckCircle size={16} color="#D4AF37" /> {notice}
                                </div>
                            )}

                            <button
                                disabled={loading}
                                className="flex h-12 w-full items-center justify-center gap-2 bg-gold-400 text-xs font-bold uppercase tracking-[0.2em] text-obsidian hover:bg-gold-300 disabled:opacity-50 rounded-sm shadow-md transition"
                            >
                                {loading ? (
                                    'Please wait…'
                                ) : (
                                    <>
                                        {mode === 'forgot' ? 'Send Reset Link' : mode === 'login' ? 'Sign In Securely' : 'Create Account'}
                                        <IconArrowRight size={16} />
                                    </>
                                )}
                            </button>
                        </form>

                        <div className="mt-6 flex items-center justify-between text-xs pt-4 border-t border-gold-500/15">
                            <button
                                type="button"
                                className="text-cream/50 hover:text-gold-300 transition font-medium"
                                onClick={() => setMode(mode === 'forgot' ? 'login' : 'forgot')}
                            >
                                {mode === 'forgot' ? 'Back to sign in' : 'Forgot password?'}
                            </button>

                            <span className="flex items-center gap-1.5 text-cream/40 text-[11px]">
                                <IconShieldCheck size={14} className="text-gold-400" /> Secure session
                            </span>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default AuthPage;
