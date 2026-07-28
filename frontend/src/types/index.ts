export interface Category {
    id: string;
    name: string;
    slug: string;
    description?: string | null;
    isPublished: boolean;
    sortOrder: number;
}

export interface ProductVariant {
    id: string;
    sku: string;
    name: string;
    pricePaise: number;
    compareAtPricePaise?: number | null;
    attributes?: Record<string, unknown>;
    isActive: boolean;
}

export interface ProductImage {
    id: string;
    thumbnailUrl: string;
    mediumUrl: string;
    largeUrl: string;
    altText: string;
    sortOrder: number;
}

export interface ProductVideo {
    id: string;
    url: string;
    altText: string;
    sortOrder: number;
    sourceMimeType?: string | null;
}

export interface Product {
    id: string;
    categoryId: string;
    name: string;
    slug: string;
    shortDescription?: string | null;
    description?: string | null;
    material?: string | null;
    dimensions?: string | null;
    status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
    attributes?: Record<string, unknown>;
    category: Category;
    variants: ProductVariant[];
    images: ProductImage[];
    videos: ProductVideo[];
    createdAt?: string;
}

export interface PaginatedProducts {
    items: Product[];
    total: number;
    page: number;
    limit: number;
}

export interface SupabaseUser {
    id: string;
    email?: string;
    user_metadata?: { full_name?: string };
}

export interface Session {
    user: SupabaseUser | null;
}

export interface AuthResult {
    authenticated: boolean;
    user: SupabaseUser | null;
    csrfToken?: string;
}

export interface CartItem {
    id: string;
    variantId: string;
    sku: string;
    productName: string;
    variantName: string;
    imageUrl: string | null;
    quantity: number;
    unitPricePaise: number;
    lineTotalPaise: number;
}

export interface Cart {
    id: string;
    status: string;
    expiresAt: string;
    items: CartItem[];
    subtotalPaise: number;
}

export interface CreatedCart {
    cart: Cart;
    guestToken?: string;
}

export interface ShippingAddressInput {
    recipientName: string;
    phone: string;
    line1: string;
    line2: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
}

export interface Address extends ShippingAddressInput {
    id: string;
    userId: string;
    label: string;
    isDefault: boolean;
}

export interface Profile {
    id: string;
    email: string;
    fullName: string;
    phone?: string | null;
}

export interface CheckoutQuote {
    id: string;
    cartId: string;
    subtotalPaise: number;
    discountPaise: number;
    shippingPaise: number;
    taxPaise: number;
    totalPaise: number;
    currency: string;
    expiresAt: string;
}

export interface PaymentIntent {
    keyId: string;
    razorpayOrderId: string;
    orderId: string;
    orderNumber: string;
    amount: number;
    currency: string;
    checkout: {
        items: CartItem[];
        shippingAddress: ShippingAddressInput & { email?: string };
    };
}

export interface Order {
    id: string;
    orderNumber: string;
    status: string;
    currency: string;
    itemsSnapshot: CartItem[];
    addressSnapshot: ShippingAddressInput & { email?: string };
    subtotalPaise: number;
    discountPaise: number;
    shippingPaise: number;
    taxPaise: number;
    totalPaise: number;
    createdAt: string;
    updatedAt: string;
    invoice?: { id: string } | null;
}

export interface TrackingEvent {
    id: string;
    shipmentId: string;
    providerEventId: string;
    status: string;
    message?: string | null;
    location?: string | null;
    occurredAt: string;
    createdAt: string;
}

export interface Shipment {
    id: string;
    orderId: string;
    provider: string;
    providerShipmentId?: string | null;
    trackingNumber?: string | null;
    carrier?: string | null;
    status: string;
    shippedAt?: string | null;
    deliveredAt?: string | null;
    createdAt: string;
    updatedAt: string;
    events: TrackingEvent[];
    items: Array<{ id: string; sku: string; quantity: number; variantId?: string | null }>;
}

export interface InventoryLevel {
    id: string;
    warehouseId: string;
    variantId: string;
    onHand: number;
    reserved: number;
    lowStockThreshold: number;
}

export interface OperationsSnapshot {
    databaseHealthy: boolean;
    apiServerErrorsTotal: number;
    failedWebhooks: number;
    terminalJobFailures: number;
    expiredPendingPayments: number;
    paymentMismatches: number;
    failedRefunds: number;
    lowStockSkus: number;
    checkedAt: string;
}

export interface Coupon {
    id: string;
    code: string;
    type: 'PERCENT' | 'FIXED';
    value: number;
    minimumSubtotalPaise: number;
    maximumDiscountPaise?: number | null;
    usageLimit?: number | null;
    perUserLimit?: number | null;
    startsAt: string;
    endsAt: string;
    isActive: boolean;
    createdAt: string;
}

export interface CreateCouponInput {
    code: string;
    type: 'PERCENT' | 'FIXED';
    value: number;
    minimumSubtotalPaise?: number;
    maximumDiscountPaise?: number;
    usageLimit?: number;
    perUserLimit?: number;
    startsAt: string;
    endsAt: string;
    isActive?: boolean;
}

export interface AuditLog {
    id: string;
    actorId?: string | null;
    action: string;
    entityType: string;
    entityId?: string | null;
    metadata?: Record<string, unknown>;
    ipAddress?: string | null;
    userAgent?: string | null;
    createdAt: string;
}

export interface Warehouse {
    id: string;
    code: string;
    name: string;
    isActive: boolean;
}
