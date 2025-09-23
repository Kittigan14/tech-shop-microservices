const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.json());

const userCarts = new Map();
const userOrders = new Map();

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

// Get user's cart
app.get('/cart/:userId', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const cart = userCarts.get(userId) || [];

    const cartWithProducts = [];
    for (const item of cart) {
      try {
        const product = await makeAPICall(`http://localhost:3001/products/${item.productId}`);
        cartWithProducts.push({
          productId: item.productId,
          quantity: item.quantity,
          name: product.name,
          price: product.price,
          image: product.image
        });
      } catch (error) {
        console.error('Error fetching product:', error);
      }
    }

    res.json(cartWithProducts);
  } catch (error) {
    res.status(500).json({
      error: 'ไม่สามารถดึงข้อมูลตะกร้าได้'
    });
  }
});

// Add item to cart
app.post('/cart/:userId', (req, res) => {
  const userId = parseInt(req.params.userId);
  const {
    productId,
    quantity
  } = req.body;

  if (!productId || !quantity) {
    return res.status(400).json({
      error: 'ต้องมี productId และ quantity'
    });
  }

  let cart = userCarts.get(userId) || [];
  const existingItemIndex = cart.findIndex(item => item.productId === productId);

  if (existingItemIndex !== -1) {
    cart[existingItemIndex].quantity += quantity;
  } else {
    cart.push({
      productId,
      quantity
    });
  }

  userCarts.set(userId, cart);

  res.status(200).json({
    message: 'เพิ่มสินค้าลงตะกร้าแล้ว',
    cart: cart
  });
});

// Remove item from cart
app.delete('/cart/:userId/:productId', (req, res) => {
  const userId = parseInt(req.params.userId);
  const productId = parseInt(req.params.productId);

  let cart = userCarts.get(userId);
  if (!cart) {
    return res.status(404).json({
      error: 'ไม่พบตะกร้าสินค้า'
    });
  }

  const initialLength = cart.length;
  cart = cart.filter(item => item.productId !== productId);

  if (cart.length === initialLength) {
    return res.status(404).json({
      error: 'ไม่พบสินค้าในตะกร้า'
    });
  }

  userCarts.set(userId, cart);
  res.status(200).json({
    message: 'ลบสินค้าสำเร็จ'
  });
});

// Clear cart after checkout
app.delete('/cart/:userId', (req, res) => {
  const userId = parseInt(req.params.userId);
  userCarts.delete(userId);
  res.status(200).json({
    message: 'เคลียร์ตะกร้าสินค้าแล้ว'
  });
});

// Get user's orders
app.get('/orders/:userId', (req, res) => {
  const userId = parseInt(req.params.userId);
  const orders = userOrders.get(userId) || [];
  res.json(orders);
});

// Create new order after checkout
app.post('/orders/create', (req, res) => {
  const {
    userId,
    items,
    total
  } = req.body;
  const newOrderId = `ORD-${Date.now()}`;
  const newOrder = {
    id: newOrderId,
    userId: userId,
    date: new Date().toISOString(),
    total,
    status: 'กำลังเตรียมจัดส่ง',
    items
  };

  let orders = userOrders.get(userId) || [];
  orders.push(newOrder);
  userOrders.set(userId, orders);

  res.status(201).json({
    message: 'สร้างคำสั่งซื้อสำเร็จ',
    orderId: newOrderId
  });
});

// Get all orders (for admin)
app.get('/orders', (req, res) => {
  const allOrders = Array.from(userOrders.values()).flat();
  res.json(allOrders);
});

// Start the server
const PORT = process.env.PORT || 3003;
app.listen(PORT, () => {
  console.log(`📦 Order Service running on port ${PORT}`);
});