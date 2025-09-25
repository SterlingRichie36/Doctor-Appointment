const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Configuration
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const SALT_ROUNDS = 12;

// In-memory database (replace with real database in production)
let doctors = [
      {
        id: 1,
        name: "Dr. Alice Smith",
        specialty: "Cardiologist",
        image: "https://storage.googleapis.com/a1aa/image/4f01e17c-c144-4a95-1f78-b36116685610.jpg",
        description: "Expert in heart health and cardiovascular diseases with 10 years of experience.",
        available: true
    },
    {
        id: 2,
        name: "Dr. John Doe",
        specialty: "Pediatrician",
        image: "https://storage.googleapis.com/a1aa/image/a89d38ec-1627-4fad-af2d-83f5c3da1f1a.jpg",
        description: "Caring for children's health and wellness with over 8 years of pediatric experience.",
        available: true
    },
    {
        id: 3, 
        name: "Dr. Maria Lopez",
        specialty: "Dermatologist",
        image: "https://storage.googleapis.com/a1aa/image/ee0515b6-c7f7-4a52-b415-d40909f4a292.jpg",
        description: "Specialist in skin care and treatment with 12 years of clinical experience.",
        available: true
    },
                    {
                        id: 4,
                        name: "Dr. David Nguyen",
                        specialty: "Neurologist",
                        image: "https://storage.googleapis.com/a1aa/image/9f3f63d3-7840-4fae-3699-1cfc387017a3.jpg",
                        description: "Experienced neurologist focusing on brain and nervous system disorders.",
                        available: true
                    },
                    {
                        id: 5,
                        name: "Dr. Emma Johnson",
                        specialty: "General Practitioner",
                        image: "https://storage.googleapis.com/a1aa/image/b0dcd950-d2de-47e2-3a53-88b50bec994b.jpg",
                        description: "Providing comprehensive primary care and health advice for all ages.",
                        available: true
                    },
                    {
                        id: 6,
                        name: "Dr. Michael Brown",
                        specialty: "Orthopedic Surgeon",
                        image: "https://storage.googleapis.com/a1aa/image/f7709932-2855-49d4-32c6-d24c6f957740.jpg",
                        description: "Specialist in bone and joint surgery with 15 years of surgical experience.",
                        available: true
                    }
    // Add other doctors...
];

let appointments = [];
let adminPasswordHash = '';

// Initialize admin password (in production, set via environment variable)
async function initializeAdmin() {
    if (!adminPasswordHash) {
        adminPasswordHash = await bcrypt.hash('admin123', SALT_ROUNDS);
    }
}

// Authentication middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid token' });
        }
        req.user = user;
        next();
    });
};

// Routes

// Get all doctors
app.get('/api/doctors', (req, res) => {
    res.json(doctors);
});

// Book appointment
app.post('/api/appointments', async (req, res) => {
    try {
        const appointmentData = req.body;
        
        // Validation
        if (!appointmentData.doctor || !appointmentData.fullName || !appointmentData.email) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Create appointment
        const appointment = {
            id: Date.now(),
            ...appointmentData,
            status: 'confirmed',
            createdAt: new Date().toISOString()
        };

        appointments.push(appointment);

        // Notify all connected clients
        io.emit('appointmentUpdated', {
            type: 'new',
            appointment: appointment
        });

        res.json({
            success: true,
            appointmentId: appointment.id,
            message: 'Appointment booked successfully'
        });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Admin login
app.post('/api/admin/login', async (req, res) => {
    try {
        const { password } = req.body;
        
        if (!password) {
            return res.status(400).json({ error: 'Password required' });
        }

        const isValid = await bcrypt.compare(password, adminPasswordHash);
        
        if (!isValid) {
            return res.status(401).json({ error: 'Invalid password' });
        }

        const token = jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '24h' });
        
        res.json({
            success: true,
            token,
            message: 'Login successful'
        });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get appointments (admin only)
app.get('/api/admin/appointments', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
    }

    res.json(appointments);
});

// Delete appointment (admin only)
app.delete('/api/admin/appointments/:id', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
    }

    const appointmentId = parseInt(req.params.id);
    const initialLength = appointments.length;
    
    appointments = appointments.filter(apt => apt.id !== appointmentId);

    if (appointments.length < initialLength) {
        // Notify all connected clients
        io.emit('appointmentUpdated', {
            type: 'deleted',
            appointmentId: appointmentId
        });

        res.json({ success: true, message: 'Appointment deleted successfully' });
    } else {
        res.status(404).json({ error: 'Appointment not found' });
    }
});

// Clear all appointments (admin only)
app.delete('/api/admin/appointments', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
    }

    const deletedCount = appointments.length;
    appointments = [];

    // Notify all connected clients
    io.emit('appointmentUpdated', {
        type: 'cleared',
        deletedCount: deletedCount
    });

    res.json({ 
        success: true, 
        message: `All ${deletedCount} appointments cleared successfully` 
    });
});

// Update appointment status
app.patch('/api/admin/appointments/:id/status', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
    }

    const { status } = req.body;
    const appointmentId = parseInt(req.params.id);
    
    const appointment = appointments.find(apt => apt.id === appointmentId);
    
    if (!appointment) {
        return res.status(404).json({ error: 'Appointment not found' });
    }

    appointment.status = status;

    // Notify all connected clients
    io.emit('appointmentUpdated', {
        type: 'statusUpdated',
        appointmentId: appointmentId,
        status: status
    });

    res.json({ success: true, message: 'Appointment status updated' });
});

// Serve frontend
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Socket.io for real-time updates
io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});

// Initialize and start server
initializeAdmin().then(() => {
    server.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
        console.log(`Admin password: admin123 (change this in production!)`);
    });
});

module.exports = app;
