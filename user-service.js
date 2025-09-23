const express = require('express');
const app = express();
const bcrypt = require('bcryptjs');

app.use(express.json());

const users = [{
    id: 1,
    username: 'admin',
    password: 'hashed_password_for_admin',
    role: 'admin'
}, {
    id: 2,
    username: 'user',
    password: 'hashed_password_for_john',
    role: 'member'
}];

const hashPasswords = async () => {
    users[0].password = await bcrypt.hash('12345678', 10);
    users[1].password = await bcrypt.hash('12345678', 10);
    users[2].password = await bcrypt.hash('12345678', 10);
    console.log('✅ Passwords have been hashed.');
};
hashPasswords();

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        users: users.length,
        timestamp: new Date().toISOString()
    });
});

// User login
app.post('/login', async (req, res) => {
    const {
        username,
        password
    } = req.body;
    const user = users.find(u => u.username === username);

    if (user && await bcrypt.compare(password, user.password)) {
        // Exclude password from the response for security
        const {
            password,
            ...userWithoutPassword
        } = user;
        res.json(userWithoutPassword);
    } else {
        res.status(401).json({
            error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง'
        });
    }
});

// Get all users (for admin)
app.get('/users', (req, res) => {
    const usersWithoutPasswords = users.map(u => {
        const {
            password,
            ...userWithoutPassword
        } = u;
        return userWithoutPassword;
    });
    res.json(usersWithoutPasswords);
});

// User registration
app.post('/register', async (req, res) => {
    const {
        username,
        password
    } = req.body;
    if (users.find(u => u.username === username)) {
        return res.status(409).json({
            error: 'ชื่อผู้ใช้นี้ถูกใช้ไปแล้ว'
        });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = {
        id: users.length + 1,
        username,
        password: hashedPassword,
        role: 'member'
    };
    users.push(newUser);
    res.status(201).json({
        message: 'ลงทะเบียนสำเร็จ',
        user: {
            id: newUser.id,
            username: newUser.username,
            role: newUser.role
        }
    });
});

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
    console.log(`👤 User Service running on port ${PORT}`);
    console.log(`📊 Sample accounts:`);
    console.log(`   Admin: admin/12345678`);
    console.log(`   Member: user/12345678`);
    console.log(`   Total users: ${users.length}`);
});