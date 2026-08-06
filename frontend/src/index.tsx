import React, { lazy, Suspense } from 'react';
import ReactDOM from 'react-dom';
import { BrowserRouter as Router, Route, Switch } from 'react-router-dom';
import ErrorBoundary from './components/ErrorBoundary';
import CartDrawer from './components/CartDrawer';
import OfflineBanner from './components/OfflineBanner';
import Toast from './components/Toast';
import { AuthProvider } from './contexts/AuthContext';
import { CartProvider } from './contexts/CartContext';
import { ToastProvider } from './contexts/ToastContext';
import { WishlistProvider } from './contexts/WishlistContext';
import './index.css';

import ScrollToTop from './components/ScrollToTop';
import FloatingContactButtons from './components/FloatingContactButtons';

const HomePage = lazy(() => import('./pages'));
const AccountPage = lazy(() => import('./pages/account'));
const AdminPage = lazy(() => import('./pages/admin'));
const AuthPage = lazy(() => import('./pages/auth'));
const CartPage = lazy(() => import('./pages/cart'));
const CategoryPage = lazy(() => import('./pages/category'));
const CheckoutPage = lazy(() => import('./pages/checkout'));
const ErrorPage = lazy(() => import('./pages/error'));
const OrderConfirmationPage = lazy(() => import('./pages/order-confirmation'));
const OrderDetailPage = lazy(() => import('./pages/order'));
const OrderLookupPage = lazy(() => import('./pages/order-lookup'));
const ProductDetailPage = lazy(() => import('./pages/product'));
const ResetPasswordPage = lazy(() => import('./pages/reset-password'));
const SearchPage = lazy(() => import('./pages/search'));
const WishlistPage = lazy(() => import('./pages/wishlist'));
const InfoPage = lazy(() => import('./pages/info'));

const RouteFallback = () => (
  <div className="grid min-h-screen place-items-center bg-obsidian text-gold-300" role="status">
    <span className="text-xs uppercase tracking-[0.28em]">Loading Glockery…</span>
  </div>
);

ReactDOM.render(
  <React.StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <CartProvider>
          <WishlistProvider>
            <ToastProvider>
              <OfflineBanner />
              <Router>
                <ScrollToTop />
                <FloatingContactButtons />
                <Suspense fallback={<RouteFallback />}>
                  <Switch>
                    <Route exact path="/" component={HomePage} />
                    <Route exact path="/cart" component={CartPage} />
                    <Route exact path="/checkout" component={CheckoutPage} />
                    <Route exact path="/auth" component={AuthPage} />
                    <Route exact path="/auth/reset-password" component={ResetPasswordPage} />
                    <Route exact path="/search" component={SearchPage} />
                    <Route exact path="/wishlist" component={WishlistPage} />
                    <Route exact path="/about" render={() => <InfoPage kind="about" />} />
                    <Route exact path="/shipping-returns" render={() => <InfoPage kind="shipping" />} />
                    <Route exact path="/faq" render={() => <InfoPage kind="faq" />} />
                    <Route exact path="/contact" render={() => <InfoPage kind="contact" />} />
                    <Route exact path="/privacy" render={() => <InfoPage kind="privacy" />} />
                    <Route exact path="/terms" render={() => <InfoPage kind="terms" />} />
                    <Route exact path="/order-confirmation/:orderId" component={OrderConfirmationPage} />
                    <Route exact path="/order-lookup" component={OrderLookupPage} />
                    <Route path="/account/orders/:orderId" component={OrderDetailPage} />
                    <Route path="/account" component={AccountPage} />
                    <Route path="/admin" component={AdminPage} />
                    <Route path="/category/:categoryId" component={CategoryPage} />
                    <Route path="/product/:productId" component={ProductDetailPage} />
                    <Route component={ErrorPage} />
                  </Switch>
                </Suspense>
                <CartDrawer />
                <Toast />
              </Router>
            </ToastProvider>
          </WishlistProvider>
        </CartProvider>
      </AuthProvider>
    </ErrorBoundary>
  </React.StrictMode>,
  document.getElementById('root')
);
