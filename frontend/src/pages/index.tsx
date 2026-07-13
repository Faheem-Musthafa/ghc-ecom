import React from 'react';
import { Link } from 'react-router-dom';
import ProductCard from '../components/ProductCard';
import { useCart } from '../contexts/CartContext';
import { categories, products, canisterImg, kettleImg, cutleryImg, nutsImg, jugImg, cupImg, logo } from '../data/products';

const HomePage: React.FC = () => {
    const cartContext = useCart();
    const cartCount = cartContext?.state.items.length || 0;

    const filteredProducts = products;

    return (
        <div>
            {/* Header */}
            <header className="header">
                <div className="header-content">
                    <Link to="/" className="header-logo-link" aria-label="Glockry Home Center home">
                        <img src={logo} alt="Glockry Home Center" className="header-logo-image" />
                    </Link>
                    <nav className="header-nav">
                        <Link to="/" className="nav-link">Home</Link>
                        <a href="#products" className="nav-link">Products</a>
                        <Link to="/cart" className="cart-link">
                            Cart {cartCount > 0 && <span className="cart-badge">{cartCount}</span>}
                        </Link>
                        <a href="#contact" className="nav-link">Contact</a>
                    </nav>
                </div>
            </header>

            {/* Hero Section */}
            <section className="hero-section">
                <div className="hero-custom-inner">
                    <div className="hero-left">
                        <span className="hero-eyebrow">Premium crockery destination</span>
                        <img src={logo} alt="Glockry Home Center" className="hero-brand-logo" />
                        <p className="hero-copy">
                            Premium crockery crafted for elegant homes. Discover refined canister sets,
                            signature serveware, and luxury table pieces designed to elevate everyday dining.
                        </p>
                        <a href="#products" className="hero-btn">
                            Buy Now
                        </a>
                        <div className="hero-stats">
                            <div className="hero-stat">
                                <strong>10k+</strong>
                                <span>Happy homes</span>
                            </div>
                            <div className="hero-stat">
                                <strong>Premium</strong>
                                <span>Finish & feel</span>
                            </div>
                            <div className="hero-stat">
                                <strong>Luxury</strong>
                                <span>Everyday dining</span>
                            </div>
                        </div>
                    </div>

                    <div className="hero-right">
                        <div className="hero-visual-stack">
                            <div className="hero-frame">
                                <img
                                    src={kettleImg}
                                    alt="Premium crockery collection"
                                    className="hero-main-shot"
                                />
                            </div>
                            <div className="hero-side-card hero-side-card-top">
                                <img src={canisterImg} alt="Luxury canister set" />
                                <div>
                                    <span>Signature set</span>
                                    <strong>Elegant storage collection</strong>
                                </div>
                            </div>
                            <div className="hero-side-card hero-side-card-bottom">
                                <img src={cutleryImg} alt="Luxury cutlery set" />
                                <div>
                                    <span>Gold accent</span>
                                    <strong>Premium table styling</strong>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <section className="category-section">
                <h2>Shop by Category</h2>
                <div className="category-grid">
                    {categories.map(category => (
                        <Link key={category.id} to={`/category/${category.id}`} className="category-card-link">
                            <div className="category-card">
                                <img src={category.imageUrl} alt={category.name} />
                                <div className="category-label">{category.name}</div>
                            </div>
                        </Link>
                    ))}
                </div>
            </section>

            {/* Features Section */}
            <section className="features-section">
                <div className="feature-item">
                    <span>HIGH QUALITY</span>
                </div>
                <div className="feature-item">
                    <span>FREE SHIPPING</span>
                </div>
                <div className="feature-item">
                    <span>EASY RETURNS</span>
                </div>
            </section>

            {/* Featured Products */}
            <section className="featured-products">
                <div className="product-card-large">
                    <Link to="#products">
                        <img src={canisterImg} alt="Round Canister Set" />
                        <h3>Round Canister Set</h3>
                    </Link>
                </div>
                <div className="product-card-large top-selling">
                    <div className="badge">TOP SELLING</div>
                    <Link to="#products">
                        <img src={kettleImg} alt="Square Canister Set" />
                        <h3>Square Canister Set</h3>
                    </Link>
                </div>
            </section>

            {/* About Section */}
            <section className="about-section">
                <div className="about-item">
                    <img src={nutsImg} alt="Modern design" />
                    <div className="about-content">
                        <h2>Modern design</h2>
                        <p><strong>Designed with purpose, crafted for modern living</strong></p>
                    </div>
                </div>
                <div className="about-item">
                    <img src={cutleryImg} alt="Quality Materials" />
                    <div className="about-content">
                        <h2>Quality Materials</h2>
                        <p>Made with strong ceramic and natural bamboo for long-lasting use.</p>
                    </div>
                </div>
                <div className="about-item">
                    <img src={jugImg} alt="Made for Your Home" />
                    <div className="about-content">
                        <h2>Made for Your Home</h2>
                        <p>Beautiful and practical essentials for everyday living.</p>
                    </div>
                </div>
            </section>

            {/* Banner Section */}
            <section className="trusted-by-banner">
                <img
                    className="banner-image"
                    src={nutsImg}
                    alt="Trusted by customers"
                    loading="lazy"
                />
                <div className="banner-overlay"></div>
                <div className="banner-content">
                    <h2 className="banner-title">Trusted By 10k+ Family</h2>
                    <p className="banner-subtitle">Quality products loved by households</p>
                </div>
            </section>

            {/* Testimonials Section */}
            <section className="testimonials-section">
                <h2>Trusted By 10k+ Family</h2>
                <div className="testimonials-content">
                    <div className="testimonial-logos">
                        <div className="logo-placeholder">Home</div>
                        <div className="logo-placeholder">Family</div>
                        <div className="logo-placeholder">Style</div>
                        <div className="logo-placeholder">Kitchen</div>
                    </div>
                    <div className="testimonial-text">
                        <img src={nutsImg} alt="Trusted by customers" />
                        <h2>Trusted By 10k+ Family</h2>
                        <p>Quality products loved by households</p>
                    </div>
                </div>
            </section>

            {/* All Products Section */}
            <section id="products" className="products-section">
                <h2>Our Premium Crockery Collection</h2>
                <div className="products-grid">
                    {filteredProducts.map(product => (
                        <ProductCard key={product.id} product={product} />
                    ))}
                </div>
            </section>

            {/* Footer */}
            <footer className="footer">
                <div className="footer-content">
                    <div className="email-signup">
                        <h2>Join our email list</h2>
                        <p>Get exclusive deals and early access to new products.</p>
                        <form className="signup-form">
                            <input type="email" placeholder="Email address" />
                            <button type="submit">Sign up</button>
                        </form>
                    </div>
                    <a href="https://wa.me/919207232303" className="whatsapp-link" target="_blank" rel="noopener noreferrer">
                        <img src="https://img.icons8.com/color/48/000000/whatsapp.png" alt="Chat on WhatsApp" />
                        Chat on WhatsApp
                    </a>
                </div>
            </footer>
        </div>
    );
};

export default HomePage;
