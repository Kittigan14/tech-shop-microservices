const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const path = require('path');
const session = require('express-session');
const axios = require('axios');
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

const SERVICES = {
    PRODUCT: 'http://localhost:3001',
    USER: 'http://localhost:3002',
    ORDER: 'http://localhost:3003',
    PAYMENT: 'http://localhost:3004'
};

async function makeAPICall(url, method = 'get', data = null) {
    try {
        const response = await axios({ method, url, data });
        return response.data;
    } catch (err) {
        console.error("API Error:", err.response?.data?.error || err.message);
        throw err;
    }
}

app.get('/', async (req, res) => {
    try {
        const products = await makeAPICall(`${SERVICES.PRODUCT}/products`);
        const categories = [...new Set(products.map(p => p.category))];
        const brands = [...new Set(products.map(p => p.brand))];
        res.render('index', {
            title: 'หน้าหลัก',
            user: req.session.user,
            products,
            categories,
            brands
        });
    } catch (err) {
        console.error('Failed to fetch data for index page:', err);
        res.render('error', {
            title: 'Error',
            message: 'ไม่สามารถโหลดข้อมูลสินค้าได้',
            user: req.session.user
        });
    }
});

app.get('/login', (req, res) => {
    res.render('login', {
        title: 'เข้าสู่ระบบ',
        user: req.session.user,
        error: null
    });
});

app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const user = await makeAPICall(`${SERVICES.USER}/login`, 'post', { username, password });
        if (user) {
            req.session.user = user;
            if (user.role === 'admin') {
                res.redirect('/admin');
            } else {
                res.redirect('/');
            }
        } else {
            res.render('login', { title: 'เข้าสู่ระบบ', user: req.session.user, error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
        }
    } catch (err) {
        res.render('login', { title: 'เข้าสู่ระบบ', user: req.session.user, error: err.response?.data?.error || 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
    }
});

app.get('/register', (req, res) => {
    res.render('register', { title: 'ลงทะเบียน', user: req.session.user, error: null, success: null });
});

app.post('/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        await makeAPICall(`${SERVICES.USER}/register`, 'post', { username, password });
        res.render('register', { title: 'ลงทะเบียน', user: req.session.user, success: 'ลงทะเบียนสำเร็จ! กรุณาเข้าสู่ระบบ', error: null });
    } catch (err) {
        const errorMsg = err.response?.data?.error || 'เกิดข้อผิดพลาดในการลงทะเบียน';
        res.render('register', { title: 'ลงทะเบียน', user: req.session.user, success: null, error: errorMsg });
    }
});

app.get('/cart', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }
    res.render('cart', {
        title: 'ตะกร้าสินค้า',
        user: req.session.user,
        error: null
    });
});

app.get('/api/cart', async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    
    try {
        const userId = req.session.user.id;
        const cart = await makeAPICall(`${SERVICES.ORDER}/cart/${userId}`);
        res.json(cart);
    } catch (err) {
        console.error('Get Cart Error:', err);
        res.status(500).json({ error: 'ไม่สามารถดึงข้อมูลตะกร้าได้' });
    }
});

app.post('/api/cart', async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    
    try {
        const userId = req.session.user.id;
        const { productId, quantity } = req.body;
        
        if (!productId || !quantity) {
            return res.status(400).json({ error: 'ต้องมี productId และ quantity' });
        }
        
        const result = await makeAPICall(`${SERVICES.ORDER}/cart/${userId}`, 'post', { productId, quantity });
        res.json(result);
    } catch (err) {
        console.error('Add to Cart Error:', err);
        res.status(500).json({ error: 'ไม่สามารถเพิ่มสินค้าลงตะกร้าได้' });
    }
});

app.delete('/api/cart/:productId', async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    
    try {
        const userId = req.session.user.id;
        const productId = req.params.productId;
        
        const result = await makeAPICall(`${SERVICES.ORDER}/cart/${userId}/${productId}`, 'delete');
        res.json(result);
    } catch (err) {
        console.error('Remove from Cart Error:', err);
        res.status(500).json({ error: 'ไม่สามารถลบสินค้าจากตะกร้าได้' });
    }
});

app.post('/api/payments/checkout', async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    
    try {
        const userId = req.session.user.id; 
        
        const cartItems = await makeAPICall(`${SERVICES.ORDER}/cart/${userId}`);
        
        if (!cartItems || cartItems.length === 0) {
            return res.status(400).json({ error: 'ตะกร้าสินค้าว่างเปล่า' });
        }
        
        const totalAmount = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        
        const paymentResult = await makeAPICall(`${SERVICES.PAYMENT}/payments/checkout`, 'post', { 
            userId, 
            totalAmount 
        });
        
        if (paymentResult.status === 'success') {
            const orderData = {
                userId,
                items: cartItems,
                total: totalAmount
            };
            
            const orderResult = await makeAPICall(`${SERVICES.ORDER}/orders/create`, 'post', orderData);
            
            await makeAPICall(`${SERVICES.ORDER}/cart/${userId}`, 'delete');
            
            return res.json({ 
                message: 'ชำระเงินสำเร็จและสร้างคำสั่งซื้อแล้ว', 
                orderId: orderResult.orderId 
            });
        } else {
            return res.status(400).json({ error: 'การชำระเงินล้มเหลว' });
        }
    } catch (err) {
        console.error('Checkout error:', err);
        return res.status(500).json({ error: 'เกิดข้อผิดพลาดในการชำระเงิน' });
    }
});

app.get('/orders', async (req, res) => {
    if (req.session.user) {
        try {
            const userId = req.session.user.id;
            const orders = await makeAPICall(`${SERVICES.ORDER}/orders/${userId}`);
            res.render('orders', {
                title: 'ประวัติการสั่งซื้อ',
                user: req.session.user,
                orders
            });
        } catch (err) {
            console.error('Failed to fetch orders for user:', err);
            res.render('error', {
                title: 'Error',
                message: 'ไม่สามารถโหลดข้อมูลประวัติการสั่งซื้อได้',
                user: req.session.user
            });
        }
    } else {
        res.redirect('/login');
    }
});

app.get('/product/:id', async (req, res) => {
    try {
        const product = await makeAPICall(`${SERVICES.PRODUCT}/products/${req.params.id}`);
        res.render('product-detail', {
            title: 'รายละเอียดสินค้า',
            user: req.session.user,
            product: product
        });
    } catch (err) {
        console.error('Failed to fetch product:', err);
        res.render('error', {
            title: 'Error',
            message: 'ไม่พบสินค้าที่ต้องการ',
            user: req.session.user
        });
    }
});

app.get('/admin', async (req, res) => {
    if (req.session.user && req.session.user.role === 'admin') {
        try {
            const products = await makeAPICall(`${SERVICES.PRODUCT}/products`);
            const users = await makeAPICall(`${SERVICES.USER}/users`);
            const orders = await makeAPICall(`${SERVICES.ORDER}/orders`);
            const payments = await makeAPICall(`${SERVICES.PAYMENT}/payments/stats`);
            res.render('admin', {
                title: 'แผงควบคุมผู้ดูแลระบบ',
                user: req.session.user,
                products,
                users,
                orders,
                payments
            });
        } catch (err) {
            console.error('Failed to fetch data for admin page:', err);
            res.render('error', {
                title: 'Error',
                message: 'ไม่สามารถโหลดข้อมูลสำหรับหน้า Admin ได้',
                user: req.session.user
            });
        }
    } else {
        res.redirect('/login');
    }
});

function isAdmin(req, res, next) {
    if (req.session.user && req.session.user.role === 'admin') {
        return next();
    }
    return res.status(403).json({ error: 'Unauthorized: admin only' });
}

app.post('/api/products/add', isAdmin, async (req, res) => {
    try {
        const newProduct = req.body;
        const result = await makeAPICall(`${SERVICES.PRODUCT}/products`, 'post', newProduct);
        return res.status(201).json(result);
    } catch (err) {
        console.error("Add Product Error:", err.message);
        return res.status(500).json({ error: 'ไม่สามารถเพิ่มสินค้าได้' });
    }
});

app.put('/api/products/:id', isAdmin, async (req, res) => {
    try {
        const productId = req.params.id;
        const updatedProduct = req.body;
        const result = await makeAPICall(`${SERVICES.PRODUCT}/products/${productId}`, 'put', updatedProduct);
        return res.json(result);
    } catch (err) {
        console.error("Update Product Error:", err.message);
        return res.status(500).json({ error: 'ไม่สามารถอัปเดตสินค้าได้' });
    }
});

app.delete('/api/products/:id', isAdmin, async (req, res) => {
    try {
        const productId = req.params.id;
        const result = await makeAPICall(`${SERVICES.PRODUCT}/products/${productId}`, 'delete');
        return res.json(result);
    } catch (err) {
        console.error("Delete Product Error:", err.message);
        return res.status(500).json({ error: 'ไม่สามารถลบสินค้าได้' });
    }
});

app.use('/api/products', createProxyMiddleware({ target: SERVICES.PRODUCT, changeOrigin: true }));

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

app.use('/api/products', createProxyMiddleware({ target: SERVICES.PRODUCT, changeOrigin: true }));
app.use('/api/users', createProxyMiddleware({ target: SERVICES.USER, changeOrigin: true }));
app.use('/api/orders', createProxyMiddleware({ target: SERVICES.ORDER, changeOrigin: true }));
app.use('/api/payments', createProxyMiddleware({ target: SERVICES.PAYMENT, changeOrigin: true }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🌐 API Gateway running on port ${PORT}`);
    console.log('🚀 Opening browser...');
    open.default(`http://localhost:${PORT}`);
});