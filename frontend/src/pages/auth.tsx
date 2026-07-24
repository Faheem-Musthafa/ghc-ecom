import React, { FormEvent, useState } from 'react';
import { Link, Redirect, useHistory } from 'react-router-dom';
import { IconArrowRight, IconShieldCheck } from '../components/Icons';
import SEOHead from '../components/SEOHead';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import { api, getCartIdentity, saveCartIdentity } from '../lib/api';
import { useDailyTheme } from '../hooks/useDailyTheme';

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
        setLoading(true); setError(''); setNotice('');
        const form = new FormData(event.currentTarget);
        try {
            if (mode === 'forgot') {
                await api.forgotPassword(String(form.get('email')));
                setNotice('Password reset instructions have been sent if the account exists.');
                return;
            }
            const guestItems = cartContext.cart?.items || [];
            const guestIdentity = getCartIdentity();
            const session = mode === 'login'
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

    const field = 'h-13 w-full border border-gold-500/25 bg-obsidian px-4 text-sm text-cream outline-none transition placeholder:text-cream/25 focus:border-gold-400';
    return (
        <div className="min-h-screen bg-obsidian text-cream">
            <SEOHead title="Sign in | Glockery" />
            <header className="flex h-20 items-center justify-between border-b border-gold-500/20 px-6 sm:px-10"><Link to="/" className="font-display text-2xl tracking-[0.2em] text-gold-300">GLOCKERY</Link><Link to="/" className="text-[10px] uppercase tracking-[0.2em] text-cream/45 hover:text-gold-300">Return to store</Link></header>
            <main className="grid min-h-[calc(100vh-80px)] lg:grid-cols-2">
                <div className="relative hidden overflow-hidden lg:block"><img src={theme.story} alt="Glockery premium tableware" className="absolute inset-0 h-full w-full object-cover opacity-65" /><div className="absolute inset-0 bg-gradient-to-r from-transparent to-obsidian" /><div className="absolute bottom-16 left-16 max-w-lg"><p className="text-[10px] uppercase tracking-[0.3em] text-gold-300">Private client access</p><h1 className="mt-5 font-display text-6xl leading-tight">Your collection,<br />beautifully managed.</h1><p className="mt-5 text-sm leading-7 text-cream/55">Track orders, save delivery details, and return to the pieces that caught your eye.</p></div></div>
                <div className="flex items-center justify-center px-6 py-16 sm:px-12">
                    <div className="w-full max-w-md">
                        <div className="mb-10 flex border-b border-gold-500/20">
                            {(['login', 'register'] as const).map((item) => <button key={item} onClick={() => { setMode(item); setError(''); setNotice(''); }} className={`flex-1 border-b-2 px-3 py-4 text-[10px] uppercase tracking-[0.22em] ${mode === item ? 'border-gold-400 text-gold-300' : 'border-transparent text-cream/35'}`}>{item === 'login' ? 'Sign in' : 'Create account'}</button>)}
                        </div>
                        <p className="text-[10px] uppercase tracking-[0.3em] text-gold-400">{mode === 'forgot' ? 'Account recovery' : mode === 'login' ? 'Welcome back' : 'Join Glockery'}</p>
                        <h2 className="mt-4 font-display text-4xl">{mode === 'forgot' ? 'Reset your password.' : mode === 'login' ? 'Enter your account.' : 'Begin your collection.'}</h2>
                        <form onSubmit={submit} className="mt-9 space-y-5">
                            {mode === 'register' && <label className="block"><span className="mb-2 block text-xs text-cream/55">Full name</span><input className={field} name="name" autoComplete="name" required /></label>}
                            <label className="block"><span className="mb-2 block text-xs text-cream/55">Email address</span><input className={field} name="email" type="email" autoComplete="email" required /></label>
                            {mode !== 'forgot' && <label className="block"><span className="mb-2 block text-xs text-cream/55">Password</span><input className={field} name="password" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={mode === 'login' ? 8 : 12} maxLength={128} required /><small className="mt-2 block text-[10px] text-cream/30">{mode === 'login' ? 'Enter your account password' : 'Minimum 12 characters'}</small></label>}
                            {error && <p className="border border-red-500/30 bg-red-950/20 p-3 text-sm text-red-200">{error}</p>}
                            {notice && <p className="border border-gold-500/30 bg-gold-950/20 p-3 text-sm text-gold-200">{notice}</p>}
                            <button disabled={loading} className="flex h-14 w-full items-center justify-center gap-3 bg-gold-400 text-xs font-bold uppercase tracking-[0.2em] text-obsidian hover:bg-gold-300 disabled:opacity-50">{loading ? 'Please wait…' : <>{mode === 'forgot' ? 'Send reset link' : mode === 'login' ? 'Sign in securely' : 'Create account'} <IconArrowRight size={17} /></>}</button>
                        </form>
                        <div className="mt-6 flex items-center justify-between text-xs"><button className="text-cream/40 hover:text-gold-300" onClick={() => setMode(mode === 'forgot' ? 'login' : 'forgot')}>{mode === 'forgot' ? 'Back to sign in' : 'Forgot password?'}</button><span className="flex items-center gap-2 text-cream/30"><IconShieldCheck size={14} /> Secured session</span></div>
                    </div>
                </div>
            </main>
        </div>
    );
};
export default AuthPage;
