const express = require('express');
const path = require('path');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const open = require('open');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
    secret: 'your_secret_key',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }
}));

// ================= DATA =================
let nextProductId = 11;
let products = [{
    id: 1,
    name: "iPhone 15 Pro",
    price: 41900,
    description: "สุดยอดนวัตกรรมสมาร์ทโฟน",
    category: "Smartphone",
    brand: "Apple",
    stock: 50,
    image: "https://images.unsplash.com/photo-1702289613007-8b830e2520b0?q=80&w=1470&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"
}, {
    id: 2,
    name: "Samsung Galaxy S24 Ultra",
    price: 46900,
    description: "ดีไซน์หรูหราพร้อม AI",
    category: "Smartphone",
    brand: "Samsung",
    stock: 50,
    image: "https://images.unsplash.com/photo-1705585175110-d25f92c183aa?q=80&w=732&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"
}, {
    id: 3,
    name: "MacBook Pro M3",
    price: 65900,
    description: "แล็ปท็อประดับมืออาชีพ",
    category: "Laptop",
    brand: "Apple",
    stock: 50,
    image: "https://images.unsplash.com/photo-1650750018363-ff7ffe460f4b?q=80&w=1009&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"
}, {
    id: 4,
    name: "Dell XPS 15",
    price: 59900,
    description: "ประสิทธิภาพสูงสำหรับนักสร้างสรรค์",
    category: "Laptop",
    brand: "Dell",
    stock: 50,
    image: "https://images.unsplash.com/photo-1575320854760-bfffc3550640?q=80&w=1470&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"
}, {
    id: 5,
    name: "Apple Watch Series 9",
    price: 15900,
    description: "สมาร์ทวอทช์คู่ใจ",
    category: "Smartwatch",
    brand: "Apple",
    stock: 50,
    image: "https://images.unsplash.com/photo-1705307543536-06ebcb39bb0c?q=80&w=1470&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"
}, {
    id: 6,
    name: "Garmin Fenix 7",
    price: 24900,
    description: "นาฬิกาสปอร์ตสำหรับนักผจญภัย",
    category: "Smartwatch",
    brand: "Garmin",
    stock: 50,
    image: "https://static.garmincdn.com/en/products/010-02540-20/g/36194-16-e091320e-ea2f-4a9b-a654-71ebfe286e0d.jpg"
}, {
    id: 7,
    name: "Sony WH-1000XM5",
    price: 13900,
    description: "หูฟังตัดเสียงรบกวน",
    category: "Headphones",
    brand: "Sony",
    stock: 50,
    image: "https://www.sony.co.th/image/6145c1d32e6ac8e63a46c912dc33c5bb?fmt=pjpeg&wid=330&bgcolor=FFFFFF&bgc=FFFFFF"
}, {
    id: 8,
    name: "Bose QuietComfort Earbuds II",
    price: 10900,
    description: "หูฟังไร้สาย",
    category: "Headphones",
    brand: "Bose",
    stock: 50,
    image: "https://www.atprosound.com/wp-content/uploads/2023/08/Bose-QuietComfort-Earbuds-II-Black-AT-Prosound.jpg"
}];
let users = [];
let carts = new Map();
let orders = new Map();
let payments = new Map();

// ================= SERVICE STATE (FOR MONOLITH MOCK) =================
const serviceState = {
    PRODUCT: true,
    USER: true,
    ORDER: true,
    PAYMENT: true
};

// ================= USERS =================
(async () => {
    users = [
        { id: 1, username: 'admin', password: await bcrypt.hash('12345678', 10), role: 'admin' },
        { id: 2, username: 'user', password: await bcrypt.hash('12345678', 10), role: 'member' }
    ];
})();

// ================= MIDDLEWARE =================
function isAdmin(req, res, next) {
    if (req.session.user?.role === 'admin') return next();
    return res.status(403).json({ error: 'Unauthorized' });
}

// NEW: Middleware to check the service status before allowing access to a route
function checkMonolithServiceStatus(serviceKey) {
    return (req, res, next) => {
        if (!serviceState[serviceKey]) {
            if (req.path.startsWith('/api/')) {
                return res.status(503).json({
                    error: `Service Unavailable: The '${serviceKey}' service is turned off.`
                });
            } else {
                return res.status(503).render('error', {
                    title: 'Service Unavailable',
                    message: `The ${serviceKey} service is currently turned off by the admin.`,
                    user: req.session.user
                });
            }
        }
        next();
    };
}

// ================= AUTH ROUTES =================
app.get('/login', (req, res) => res.render('login', { title: 'เข้าสู่ระบบ', user: req.session.user, error: null }));
app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const user = users.find(u => u.username === username);
    if (user && await bcrypt.compare(password, user.password)) {
        req.session.user = { id: user.id, username: user.username, role: user.role };
        return res.redirect(user.role === 'admin' ? '/admin' : '/');
    }
    res.render('login', { title: 'เข้าสู่ระบบ', user: null, error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
});

app.get('/register', (req, res) => res.render('register', { title: 'ลงทะเบียน', user: req.session.user, error: null, success: null }));
app.post('/register', async (req, res) => {
    const { username, password } = req.body;
    if (users.find(u => u.username === username)) {
        return res.render('register', { title: 'ลงทะเบียน', user: null, error: 'ชื่อผู้ใช้นี้ถูกใช้แล้ว', success: null });
    }
    const hashed = await bcrypt.hash(password, 10);
    const newUser = { id: users.length + 1, username, password: hashed, role: 'member' };
    users.push(newUser);
    res.render('register', { title: 'ลงทะเบียน', user: null, error: null, success: 'สมัครสมาชิกสำเร็จ! กรุณาเข้าสู่ระบบ' });
});

app.get('/logout', (req, res) => { req.session.destroy(); res.redirect('/'); });

// ================= PRODUCTS =================
app.get('/', checkMonolithServiceStatus('PRODUCT'), (req, res) => {
    const categories = [...new Set(products.map(p => p.category))];
    const brands = [...new Set(products.map(p => p.brand))];
    res.render('index', { title: 'หน้าหลัก', user: req.session.user, products, categories, brands });
});

app.get('/product/:id', checkMonolithServiceStatus('PRODUCT'), (req, res) => {
    const product = products.find(p => p.id == req.params.id);
    if (!product) return res.render('error', { title: 'Error', message: 'ไม่พบสินค้า', user: req.session.user });
    res.render('product-detail', { title: 'รายละเอียดสินค้า', product, user: req.session.user });
});

// CRUD for admin
app.post('/api/products/add', isAdmin, checkMonolithServiceStatus('PRODUCT'), (req, res) => {
    const newProduct = { id: nextProductId++, ...req.body };
    products.push(newProduct);
    res.status(201).json(newProduct);
});
app.put('/api/products/:id', isAdmin, checkMonolithServiceStatus('PRODUCT'), (req, res) => {
    const id = parseInt(req.params.id);
    const index = products.findIndex(p => p.id === id);
    if (index === -1) return res.status(404).json({ error: 'ไม่พบสินค้า' });
    products[index] = { ...products[index], ...req.body, id };
    res.json(products[index]);
});
app.delete('/api/products/:id', isAdmin, checkMonolithServiceStatus('PRODUCT'), (req, res) => {
    const id = parseInt(req.params.id);
    products = products.filter(p => p.id !== id);
    res.json({ message: 'ลบสินค้าสำเร็จ' });
});

// ================= CART =================
app.get('/cart', checkMonolithServiceStatus('ORDER'), (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    res.render('cart', { title: 'ตะกร้าสินค้า', user: req.session.user });
});

app.get('/api/cart', checkMonolithServiceStatus('ORDER'), (req, res) => {
    const userId = req.session.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const cart = carts.get(userId) || [];
    const cartWithProducts = cart.map(item => {
        const product = products.find(p => p.id == item.productId);
        return { ...item, ...product };
    });
    res.json(cartWithProducts);
});
app.post('/api/cart', checkMonolithServiceStatus('ORDER'), (req, res) => {
    const { productId, quantity } = req.body;
    const userId = req.session.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    let cart = carts.get(userId) || [];
    const existing = cart.find(c => c.productId == productId);
    if (existing) existing.quantity += quantity;
    else cart.push({ productId, quantity });
    carts.set(userId, cart);
    res.json(cart);
});
app.delete('/api/cart/:productId', checkMonolithServiceStatus('ORDER'), (req, res) => {
    const userId = req.session.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    let cart = carts.get(userId) || [];
    cart = cart.filter(item => item.productId != req.params.productId);
    carts.set(userId, cart);
    res.json({ message: 'ลบสินค้าแล้ว' });
});

// ================= CHECKOUT & ORDERS =================
app.post('/api/payments/checkout', checkMonolithServiceStatus('ORDER'), checkMonolithServiceStatus('PAYMENT'), (req, res) => {
    const userId = req.session.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const cart = carts.get(userId) || [];
    if (!cart.length) return res.status(400).json({ error: 'ตะกร้าว่าง' });

    const totalAmount = cart.reduce((sum, item) => {
        const p = products.find(pr => pr.id == item.productId);
        return sum + (p.price * item.quantity);
    }, 0);

    const transactionId = uuidv4();
    payments.set(transactionId, { userId, totalAmount, status: 'success', date: new Date() });

    const orderId = `ORD-${Date.now()}`;
    const newOrder = { id: orderId, userId, items: cart, totalAmount, status: 'กำลังเตรียมจัดส่ง', createdAt: new Date() };
    const userOrders = orders.get(userId) || [];
    userOrders.push(newOrder);
    orders.set(userId, userOrders);

    carts.delete(userId);
    res.json({ message: 'ชำระเงินสำเร็จ', orderId });
});

app.get('/orders', checkMonolithServiceStatus('ORDER'), (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    const userOrders = orders.get(req.session.user.id) || [];
    res.render('orders', { title: 'ประวัติการสั่งซื้อ', user: req.session.user, orders: userOrders });
});

// ================= ADMIN DASHBOARD & SERVICE MGMT =================
app.get('/admin', isAdmin, (req, res) => {
    res.render('admin', {
        title: 'แผงควบคุมผู้ดูแลระบบ',
        user: req.session.user,
        products,
        users: users.map(u => ({ id: u.id, username: u.username, role: u.role })),
        orders: Array.from(orders.values()).flat(),
        payments: { totalAmount: Array.from(payments.values()).reduce((sum, p) => sum + p.totalAmount, 0) }
    });
});

app.get('/admin/services', isAdmin, (req, res) => {
    res.render('services', {
        title: 'จัดการ Service (Monolith)',
        user: req.session.user,
        serviceState
    });
});

app.post('/api/admin/services/toggle', isAdmin, (req, res) => {
    const { serviceKey } = req.body;
    if (serviceState.hasOwnProperty(serviceKey)) {
        serviceState[serviceKey] = !serviceState[serviceKey];
        console.log(`[Monolith Mock] Toggled ${serviceKey} to ${serviceState[serviceKey] ? 'ON' : 'OFF'}`);
        res.json({
            message: `${serviceKey} toggled (simulation only)`,
            state: serviceState[serviceKey]
        });
    } else {
        res.status(400).json({ error: 'Service key is invalid' });
    }
});

// ================= START SERVER =================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Monolith app running at http://localhost:${PORT}`);
    open.default(`http://localhost:${PORT}`);
});