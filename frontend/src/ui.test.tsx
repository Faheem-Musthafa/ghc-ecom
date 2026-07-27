import React from 'react';
import ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';
import { MemoryRouter, Route } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from './contexts/AuthContext';
import { CartProvider } from './contexts/CartContext';
import HomePage from './pages';
import AccountPage from './pages/account';
import AdminPage from './pages/admin';
import AuthPage from './pages/auth';
import CartPage from './pages/cart';
import ProductDetailPage from './pages/product';
import { serializeJsonLd } from './components/SEOHead';
import { saveSession } from './lib/api';
import { Product } from './types';

const product: Product = {
    id: '22222222-2222-4222-8222-222222222222',
    categoryId: '11111111-1111-4111-8111-111111111111',
    name: 'Noir Gold Serving Set',
    slug: 'noir-gold-serving-set',
    shortDescription: 'A dramatic serving set.',
    description: 'Gold-finished tableware for memorable evenings.',
    status: 'PUBLISHED',
    attributes: { material: 'Stainless steel' },
    category: { id: '11111111-1111-4111-8111-111111111111', name: 'Serveware', slug: 'serveware', isPublished: true, sortOrder: 0 },
    variants: [{ id: '33333333-3333-4333-8333-333333333333', sku: 'GHC-NOIR-1', name: 'Gold', pricePaise: 249900, isActive: true }],
    images: [{ id: '44444444-4444-4444-8444-444444444444', thumbnailUrl: '/product.webp', mediumUrl: '/product.webp', largeUrl: '/product.webp', altText: 'Noir Gold Serving Set', sortOrder: 0 }],
};

const emptyCart = {
    id: '55555555-5555-4555-8555-555555555555',
    status: 'ACTIVE',
    expiresAt: '2026-07-24T00:00:00.000Z',
    items: [],
    subtotalPaise: 0,
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
let mockAuthenticated = false;

const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith('/auth/csrf')) return json({ csrfToken: 'test-csrf-token' });
    if (url.endsWith('/auth/session')) {
        return mockAuthenticated
            ? json({ authenticated: true, user: { id: 'user-1', email: 'admin@example.com' } })
            : json({ authenticated: false, user: null });
    }
    if (url.endsWith('/auth/refresh')) return json({ message: 'Session refresh is unavailable' }, 401);
    if (url.endsWith('/carts') && init?.method === 'POST') return json({ cart: emptyCart, guestToken: 'guest-token' });
    if (url.includes(`/carts/${emptyCart.id}/items`) && init?.method === 'PUT') {
        return json({ ...emptyCart, items: [{ id: 'line-1', variantId: product.variants[0].id, sku: product.variants[0].sku, productName: product.name, variantName: 'Gold', imageUrl: '/product.webp', quantity: 1, unitPricePaise: 249900, lineTotalPaise: 249900 }], subtotalPaise: 249900 });
    }
    if (url.endsWith('/categories')) return json([product.category]);
    if (url.includes('/products?')) return json({ items: [product], total: 1, page: 1, limit: 48 });
    if (url.endsWith(`/products/${product.slug}`)) return json(product);
    if (url.includes('/admin/orders')) return json([], 403);
    if (url.includes('/admin/operations')) return json({}, 403);
    return json({});
});

const render = async (node: React.ReactNode, path = '/') => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    await act(async () => {
        ReactDOM.render(
            <AuthProvider><CartProvider><MemoryRouter initialEntries={[path]}>{node}</MemoryRouter></CartProvider></AuthProvider>,
            container,
        );
        await Promise.resolve();
        await new Promise((resolve) => window.setTimeout(resolve, 220));
    });
    return container;
};

describe('black and gold commerce UI', () => {
    beforeEach(() => {
        localStorage.clear();
        sessionStorage.clear();
        mockAuthenticated = false;
        saveSession(null);
        vi.stubGlobal('fetch', fetchMock);
        fetchMock.mockClear();
    });
    afterEach(() => {
        const root = document.body.firstElementChild;
        if (root) ReactDOM.unmountComponentAtNode(root);
        document.body.innerHTML = '';
        vi.unstubAllGlobals();
    });

    it('renders the black-and-gold storefront from the catalogue API', async () => {
        const container = await render(<HomePage />);
        expect(container.textContent).toContain('Morning ritual.');
        expect(container.textContent).toContain('Noir Gold Serving Set');
        expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/products?'), expect.anything());
        expect(fetchMock).not.toHaveBeenCalledWith(expect.stringContaining('/auth/refresh'), expect.anything());
    });

    it('loads a product by slug and writes its variant to the backend cart', async () => {
        const container = await render(<Route path="/product/:productId"><ProductDetailPage /></Route>, `/product/${product.slug}`);
        expect(container.textContent).toContain('₹2,499');
        const add = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('Add to bag'));
        await act(async () => { add?.dispatchEvent(new MouseEvent('click', { bubbles: true })); await Promise.resolve(); });
        expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining(`/carts/${emptyCart.id}/items`), expect.objectContaining({ method: 'PUT' }));
        expect(container.textContent).toContain('The bag');
    });

    it('renders an empty server-backed bag without demo products', async () => {
        const container = await render(<CartPage />, '/cart');
        expect(container.textContent).toContain('Nothing here—yet.');
        expect(container.textContent).toContain('Explore collection');
    });

    it('switches between sign-in and account registration', async () => {
        const container = await render(<AuthPage />, '/auth');
        const register = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Create account');
        await act(async () => { register?.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
        expect(container.textContent).toContain('Begin your collection.');
        expect(container.querySelector('input[name="name"]')).not.toBeNull();
    });

    it('protects customer account routes', async () => {
        const container = await render(<><Route path="/account"><AccountPage /></Route><Route path="/auth"><span>Authentication required</span></Route></>, '/account/orders');
        expect(container.textContent).toContain('Authentication required');
    });

    it('surfaces backend authorization failures in the admin console', async () => {
        mockAuthenticated = true;
        const container = await render(<AdminPage />, '/admin');
        expect(container.textContent).toContain('Operations command');
        expect(container.textContent).toContain('Request failed');
    });

    it('escapes script-closing characters in product JSON-LD', () => {
        const serialized = serializeJsonLd({ name: '</script><script>alert(1)</script>' });
        expect(serialized).not.toContain('</script>');
        expect(serialized).toContain('\\u003c/script\\u003e');
    });
});
