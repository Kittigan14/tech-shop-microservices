const express = require('express');
const app = express();

app.use(express.json());

let nextProductId = 11;

// Product data (in-memory)
const products = [{
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

products.forEach(product => {
    if (!product.stock) {
        product.stock = Math.floor(Math.random() * 100) + 10;
    }
});

app.get('/products', (req, res) => {
    res.json(products);
});

app.get('/products/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const product = products.find(p => p.id === id);
    if (product) {
        res.json(product);
    } else {
        res.status(404).json({ error: 'ไม่พบสินค้า' });
    }
});

app.post('/products', (req, res) => {
    const newProduct = req.body;
    if (!newProduct.name || !newProduct.price) {
        return res.status(400).json({ error: 'ต้องมีชื่อและราคา' });
    }
    const productToAdd = {
        id: nextProductId++,
        ...newProduct
    };
    products.push(productToAdd);
    res.status(201).json(productToAdd);
});

app.put('/products/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const updatedProduct = req.body;
    const productIndex = products.findIndex(p => p.id === id);
    if (productIndex === -1) {
        return res.status(404).json({ error: 'ไม่พบสินค้า' });
    }
    products[productIndex] = { ...products[productIndex], ...updatedProduct, id };
    res.json(products[productIndex]);
});

app.delete('/products/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const initialLength = products.length;
    const newProducts = products.filter(p => p.id !== id);
    if (newProducts.length === initialLength) {
        return res.status(404).json({ error: 'ไม่พบสินค้า' });
    }
    products.splice(0, products.length, ...newProducts);
    res.json({ message: 'ลบสินค้าสำเร็จ' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`🛍️ Product Service running on port ${PORT}`);
    console.log(`📦 Total products: ${products.length}`);
});