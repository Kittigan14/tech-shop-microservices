    const express = require('express');
    const {
        createProxyMiddleware
    } = require('http-proxy-middleware');
    const path = require('path');
    const session = require('express-session');
    const axios = require('axios');
    const open = require('open');

    const app = express();
    app.use(express.json());
    app.use(express.urlencoded({
        extended: true
    }));

    app.set('view engine', 'ejs');
    app.set('views', path.join(__dirname, 'views'));
    app.use(express.static(path.join(__dirname, 'public')));
    app.use(session({
        secret: 'your_secret_key',
        resave: false,
        saveUninitialized: false,
        cookie: {
            secure: false
        }
    }));

    const SERVICES = {
        PRODUCT: 'http://localhost:3001',
        USER: 'http://localhost:3002',
        ORDER: 'http://localhost:3003',
        PAYMENT: 'http://localhost:3004'
    };

    // Service toggle state
    const serviceState = {
        PRODUCT: true,
        USER: true,
        ORDER: true,
        PAYMENT: true
    };

    async function makeAPICall(url, method = 'get', data = null) {
        try {
            const response = await axios({
                method,
                url,
                data
            });
            return response.data;
        } catch (err) {
            console.error("API Error:", err.response ?.data ?.error || err.message);
            throw err;
        }
    }

    // -------------------- Middleware -------------------- //
    function isAdmin(req, res, next) {
        if (req.session.user && req.session.user.role === 'admin') return next();
        return res.status(403).json({
            error: 'Unauthorized: admin only'
        });
    }

    function checkServiceStatus(serviceKey) {
        return (req, res, next) => {
            if (!serviceState[serviceKey]) {
                return res.status(503).json({
                    error: `${serviceKey} service is OFF`
                });
            }
            next();
        };
    }

    // -------------------- Routes -------------------- //

    // Home
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
            res.render('error', {
                title: 'Error',
                message: 'ไม่สามารถโหลดข้อมูลสินค้าได้',
                user: req.session.user
            });
        }
    });

    // Login / Register
    app.get('/login', (req, res) => res.render('login', {
        title: 'เข้าสู่ระบบ',
        user: req.session.user,
        error: null
    }));
    app.post('/login', async (req, res) => {
        const {
            username,
            password
        } = req.body;
        try {
            const user = await makeAPICall(`${SERVICES.USER}/login`, 'post', {
                username,
                password
            });
            if (user) {
                req.session.user = user;
                res.redirect(user.role === 'admin' ? '/admin' : '/');
            } else {
                res.render('login', {
                    title: 'เข้าสู่ระบบ',
                    user: req.session.user,
                    error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง'
                });
            }
        } catch (err) {
            res.render('login', {
                title: 'เข้าสู่ระบบ',
                user: req.session.user,
                error: err.response ?.data ?.error || 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง'
            });
        }
    });

    app.get('/register', (req, res) => res.render('register', {
        title: 'ลงทะเบียน',
        user: req.session.user,
        error: null,
        success: null
    }));
    app.post('/register', async (req, res) => {
        try {
            const {
                username,
                password
            } = req.body;
            await makeAPICall(`${SERVICES.USER}/register`, 'post', {
                username,
                password
            });
            res.render('register', {
                title: 'ลงทะเบียน',
                user: req.session.user,
                success: 'ลงทะเบียนสำเร็จ! กรุณาเข้าสู่ระบบ',
                error: null
            });
        } catch (err) {
            res.render('register', {
                title: 'ลงทะเบียน',
                user: req.session.user,
                success: null,
                error: err.response ?.data ?.error || 'เกิดข้อผิดพลาดในการลงทะเบียน'
            });
        }
    });

    // Cart
    app.get('/cart', (req, res) => {
        if (!req.session.user) return res.redirect('/login');
        res.render('cart', {
            title: 'ตะกร้าสินค้า',
            user: req.session.user,
            error: null
        });
    });

    app.get('/api/cart', async (req, res) => {
        if (!req.session.user) return res.status(401).json({
            error: 'Unauthorized'
        });
        try {
            const cart = await makeAPICall(`${SERVICES.ORDER}/cart/${req.session.user.id}`);
            res.json(cart);
        } catch (err) {
            res.status(500).json({
                error: 'ไม่สามารถดึงข้อมูลตะกร้าได้'
            });
        }
    });

    app.post('/api/cart', async (req, res) => {
        if (!req.session.user) return res.status(401).json({
            error: 'Unauthorized'
        });
        try {
            const {
                productId,
                quantity
            } = req.body;
            if (!productId || !quantity) return res.status(400).json({
                error: 'ต้องมี productId และ quantity'
            });
            const result = await makeAPICall(`${SERVICES.ORDER}/cart/${req.session.user.id}`, 'post', {
                productId,
                quantity
            });
            res.json(result);
        } catch (err) {
            res.status(500).json({
                error: 'ไม่สามารถเพิ่มสินค้าลงตะกร้าได้'
            });
        }
    });

    app.delete('/api/cart/:productId', async (req, res) => {
        if (!req.session.user) return res.status(401).json({
            error: 'Unauthorized'
        });
        try {
            const result = await makeAPICall(`${SERVICES.ORDER}/cart/${req.session.user.id}/${req.params.productId}`, 'delete');
            res.json(result);
        } catch (err) {
            res.status(500).json({
                error: 'ไม่สามารถลบสินค้าจากตะกร้าได้'
            });
        }
    });

    // Checkout
    app.post('/api/payments/checkout', async (req, res) => {
        if (!req.session.user) return res.status(401).json({
            error: 'Unauthorized'
        });
        try {
            const userId = req.session.user.id;
            const cartItems = await makeAPICall(`${SERVICES.ORDER}/cart/${userId}`);
            if (!cartItems || cartItems.length === 0) return res.status(400).json({
                error: 'ตะกร้าสินค้าว่างเปล่า'
            });

            const totalAmount = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
            const paymentResult = await makeAPICall(`${SERVICES.PAYMENT}/payments/checkout`, 'post', {
                userId,
                totalAmount
            });

            if (paymentResult.status === 'success') {
                const orderResult = await makeAPICall(`${SERVICES.ORDER}/orders/create`, 'post', {
                    userId,
                    items: cartItems,
                    total: totalAmount
                });
                await makeAPICall(`${SERVICES.ORDER}/cart/${userId}`, 'delete');
                return res.json({
                    message: 'ชำระเงินสำเร็จและสร้างคำสั่งซื้อแล้ว',
                    orderId: orderResult.orderId
                });
            } else return res.status(400).json({
                error: 'การชำระเงินล้มเหลว'
            });
        } catch (err) {
            res.status(500).json({
                error: 'เกิดข้อผิดพลาดในการชำระเงิน'
            });
        }
    });

    // Orders
    app.get('/orders', async (req, res) => {
        if (!req.session.user) return res.redirect('/login');
        try {
            const orders = await makeAPICall(`${SERVICES.ORDER}/orders/${req.session.user.id}`);
            res.render('orders', {
                title: 'ประวัติการสั่งซื้อ',
                user: req.session.user,
                orders
            });
        } catch (err) {
            res.render('error', {
                title: 'Error',
                message: 'ไม่สามารถโหลดข้อมูลประวัติการสั่งซื้อได้',
                user: req.session.user
            });
        }
    });

    // Product Detail
    app.get('/product/:id', async (req, res) => {
        try {
            const product = await makeAPICall(`${SERVICES.PRODUCT}/products/${req.params.id}`);
            res.render('product-detail', {
                title: 'รายละเอียดสินค้า',
                user: req.session.user,
                product
            });
        } catch (err) {
            res.render('error', {
                title: 'Error',
                message: 'ไม่พบสินค้าที่ต้องการ',
                user: req.session.user
            });
        }
    });

    // Admin
    app.get('/admin', async (req, res) => {
        if (!req.session.user || req.session.user.role !== 'admin') return res.redirect('/login');
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
            res.render('error', {
                title: 'Error',
                message: 'ไม่สามารถโหลดข้อมูลสำหรับหน้า Admin ได้',
                user: req.session.user
            });
        }
    });

    // -------------------- Product CRUD -------------------- //
    app.post('/api/products/add', isAdmin, checkServiceStatus('PRODUCT'), async (req, res) => {
        try {
            const result = await makeAPICall(`${SERVICES.PRODUCT}/products`, 'post', req.body);
            res.status(201).json(result);
        } catch (err) {
            res.status(500).json({
                error: 'ไม่สามารถเพิ่มสินค้าได้'
            });
        }
    });

    app.put('/api/products/:id', isAdmin, checkServiceStatus('PRODUCT'), async (req, res) => {
        try {
            const result = await makeAPICall(`${SERVICES.PRODUCT}/products/${req.params.id}`, 'put', req.body);
            res.json(result);
        } catch (err) {
            res.status(500).json({
                error: 'ไม่สามารถอัปเดตสินค้าได้'
            });
        }
    });

    app.delete('/api/products/:id', isAdmin, checkServiceStatus('PRODUCT'), async (req, res) => {
        try {
            const result = await makeAPICall(`${SERVICES.PRODUCT}/products/${req.params.id}`, 'delete');
            res.json(result);
        } catch (err) {
            res.status(500).json({
                error: 'ไม่สามารถลบสินค้าได้'
            });
        }
    });

    app.get('/admin/services', isAdmin, (req, res) => {
        res.render('services', {
            title: 'จัดการ Service',
            user: req.session.user,
            serviceState
        });
    });

    app.post('/api/admin/services/toggle', isAdmin, (req, res) => {
        const {
            serviceKey
        } = req.body;
        if (!SERVICES[serviceKey]) {
            return res.status(400).json({
                error: 'Service ไม่ถูกต้อง'
            });
        }
        serviceState[serviceKey] = !serviceState[serviceKey];
        res.json({
            message: `${serviceKey} toggled`,
            state: serviceState[serviceKey]
        });
    });


    // -------------------- Proxy -------------------- //
    app.use('/api/products', checkServiceStatus('PRODUCT'), createProxyMiddleware({
        target: SERVICES.PRODUCT,
        changeOrigin: true
    }));
    app.use('/api/users', checkServiceStatus('USER'), createProxyMiddleware({
        target: SERVICES.USER,
        changeOrigin: true
    }));
    app.use('/api/orders', checkServiceStatus('ORDER'), createProxyMiddleware({
        target: SERVICES.ORDER,
        changeOrigin: true
    }));
    app.use('/api/payments', checkServiceStatus('PAYMENT'), createProxyMiddleware({
        target: SERVICES.PAYMENT,
        changeOrigin: true
    }));

    // Logout
    app.get('/logout', (req, res) => {
        req.session.destroy();
        res.redirect('/');
    });

    // -------------------- Start Server -------------------- //
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`🌐 API Gateway running on port ${PORT}`);
        open.default(`http://localhost:${PORT}`);
    });