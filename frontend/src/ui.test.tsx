import React from 'react';
import ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';
import { MemoryRouter, Route } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from './contexts/AuthContext';
import { CartProvider } from './contexts/CartContext';
import CartDrawer from './components/CartDrawer';
import Toast from './components/Toast';
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
    category: {
        id: '11111111-1111-4111-8111-111111111111',
        name: 'Serveware',
        slug: 'serveware',
        isPublished: true,
        sortOrder: 0,
    },
    variants: [
        {
            id: '33333333-3333-4333-8333-333333333333',
            sku: 'GHC-NOIR-GOLD',
            name: 'Gold',
            pricePaise: 249900,
            attributes: { color: 'Gold', colorHex: '#C5A059' },
            isActive: true,
            availableStock: 8,
        },
        {
            id: '33333333-3333-4333-8333-333333333334',
            sku: 'GHC-NOIR-SAGE',
            name: 'Sage Green',
            pricePaise: 259900,
            attributes: { color: 'Sage Green', colorHex: '#9CAF88' },
            isActive: true,
            availableStock: 5,
        },
    ],
    images: [
        {
            id: '44444444-4444-4444-8444-444444444444',
            variantId: '33333333-3333-4333-8333-333333333333',
            thumbnailUrl: '/product.webp',
            mediumUrl: '/product.webp',
            largeUrl: '/product.webp',
            altText: 'Noir Gold Serving Set in Gold',
            sortOrder: 0,
        },
        {
            id: '44444444-4444-4444-8444-444444444445',
            variantId: '33333333-3333-4333-8333-333333333334',
            thumbnailUrl: '/sage.webp',
            mediumUrl: '/sage.webp',
            largeUrl: '/sage.webp',
            altText: 'Noir Gold Serving Set in Sage Green',
            sortOrder: 0,
        },
    ],
    videos: [
        {
            id: '55555555-5555-4555-8555-555555555556',
            url: 'https://cdn.example.com/noir-gold.mp4',
            altText: 'Noir Gold Serving Set video',
            sortOrder: 1,
        },
    ],
};

const emptyCart = {
    id: '55555555-5555-4555-8555-555555555555',
    status: 'ACTIVE',
    expiresAt: '2026-07-24T00:00:00.000Z',
    items: [],
    subtotalPaise: 0,
};

const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
    });
let mockAuthenticated = false;
let currentProduct = product;

const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith('/auth/csrf')) return json({ csrfToken: 'test-csrf-token' });
    if (url.endsWith('/auth/session')) {
        return mockAuthenticated
            ? json({
                  authenticated: true,
                  user: { id: 'user-1', email: 'admin@example.com' },
              })
            : json({ authenticated: false, user: null });
    }
    if (url.endsWith('/auth/refresh')) return json({ message: 'Session refresh is unavailable' }, 401);
    if (url.endsWith('/carts') && init?.method === 'POST') return json({ cart: emptyCart, guestToken: 'guest-token' });
    if (url.includes(`/carts/${emptyCart.id}/items`) && init?.method === 'PUT') {
        const body = JSON.parse(String(init.body)) as { variantId: string };
        const variant = product.variants.find((item) => item.id === body.variantId) || product.variants[0];
        const image = product.images.find((item) => item.variantId === variant.id);
        return json({
            ...emptyCart,
            items: [
                {
                    id: 'line-1',
                    variantId: variant.id,
                    sku: variant.sku,
                    productName: product.name,
                    variantName: variant.name,
                    imageUrl: image?.thumbnailUrl,
                    quantity: 1,
                    unitPricePaise: variant.pricePaise,
                    lineTotalPaise: variant.pricePaise,
                },
            ],
            subtotalPaise: variant.pricePaise,
        });
    }
    if (url.endsWith('/categories')) return json([currentProduct.category]);
    if (url.includes('/products?')) return json({ items: [currentProduct], total: 1, page: 1, limit: 48 });
    if (url.endsWith(`/products/${product.slug}`)) return json(currentProduct);
    if (url.includes('/admin/orders')) return json([], 403);
    if (url.includes('/admin/operations')) return json({}, 403);
    return json({});
});

const render = async (node: React.ReactNode, path = '/') => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    await act(async () => {
        ReactDOM.render(
            <AuthProvider>
                <CartProvider>
                    <MemoryRouter initialEntries={[path]}>
                        {node}
                        <CartDrawer />
                        <Toast />
                    </MemoryRouter>
                </CartProvider>
            </AuthProvider>,
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
        currentProduct = product;
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

    it('renders the Vengara storefront from the catalogue API', async () => {
        const container = await render(<HomePage />);
        expect(container.textContent).toContain('Crockery and kitchenware for every home.');
        expect(container.textContent).toContain('Noir Gold Serving Set');
        expect(container.textContent).toContain('See what’s new in store');
        expect(container.textContent).toContain('Chat with Glockery on WhatsApp');
        expect(container.querySelectorAll('iframe[src*="instagram.com/reel/"]')).toHaveLength(5);
        expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/products?'), expect.anything());
        expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('limit=8'), expect.anything());
        expect(fetchMock).not.toHaveBeenCalledWith(expect.stringContaining('/auth/refresh'), expect.anything());
    });

    it('switches colour images and writes the selected variant to the backend cart', async () => {
        const container = await render(
            <Route path="/product/:productId">
                <ProductDetailPage />
            </Route>,
            `/product/${product.slug}`,
        );
        expect(container.textContent).toContain('₹2,499');
        const sageOption = container.querySelector<HTMLInputElement>(`input[value="${product.variants[1].id}"]`);
        await act(async () => {
            sageOption?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        });
        expect(container.querySelector<HTMLImageElement>('section img')?.getAttribute('src')).toBe('/sage.webp');
        expect(container.textContent).toContain('SKU GHC-NOIR-SAGE');
        expect(container.textContent).toContain('₹2,599');
        const videoThumbnail = container.querySelector<HTMLButtonElement>('button[aria-label="View video 2"]');
        await act(async () => {
            videoThumbnail?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        });
        expect(container.querySelector('video')).toBeNull();
        const playVideo = container.querySelector<HTMLButtonElement>('button[aria-label="Play Noir Gold Serving Set video"]');
        await act(async () => {
            playVideo?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        });
        expect(container.querySelector('video')).not.toBeNull();
        const add = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('Add to cart'));
        await act(async () => {
            add?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            await Promise.resolve();
        });
        expect(fetchMock).toHaveBeenCalledWith(
            expect.stringContaining(`/carts/${emptyCart.id}/items`),
            expect.objectContaining({
                method: 'PUT',
                body: expect.stringContaining(product.variants[1].id),
            }),
        );
        expect(container.textContent).toContain('The bag');
    });

    it('disables buying when every product option is out of stock', async () => {
        const unavailableProduct: Product = {
            ...product,
            variants: product.variants.map((variant) => ({ ...variant, availableStock: 0 })),
        };
        currentProduct = unavailableProduct;
        const container = await render(
            <Route path="/product/:productId">
                <ProductDetailPage />
            </Route>,
            `/product/${product.slug}`,
        );

        const add = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('Out of stock'));
        expect(add).toBeDefined();
        expect((add as HTMLButtonElement | undefined)?.disabled).toBe(true);
        expect(container.textContent).toContain('Out of stock — choose another option.');
    });

    it('renders an empty server-backed bag without demo products', async () => {
        const container = await render(<CartPage />, '/cart');
        expect(container.textContent).toContain('Nothing here—yet.');
        expect(container.textContent).toContain('Explore collection');
    });

    it('switches between sign-in and account registration', async () => {
        const container = await render(<AuthPage />, '/auth');
        const register = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Create account');
        await act(async () => {
            register?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        });
        expect(container.textContent).toContain('Begin your collection.');
        expect(container.querySelector('input[name="name"]')).not.toBeNull();
    });

    it('protects customer account routes', async () => {
        const container = await render(
            <>
                <Route path="/account">
                    <AccountPage />
                </Route>
                <Route path="/auth">
                    <span>Authentication required</span>
                </Route>
            </>,
            '/account/orders',
        );
        expect(container.textContent).toContain('Authentication required');
    });

    it('surfaces backend authorization failures in the admin console', async () => {
        mockAuthenticated = true;
        const container = await render(<AdminPage />, '/admin');
        expect(container.textContent).toContain('Admin workspace');
        expect(container.textContent).toContain('Request failed');
    });

    it('escapes script-closing characters in product JSON-LD', () => {
        const serialized = serializeJsonLd({
            name: '</script><script>alert(1)</script>',
        });
        expect(serialized).not.toContain('</script>');
        expect(serialized).toContain('\\u003c/script\\u003e');
    });
});
