const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// Mock database (in production, use real database)
let appointments = [];
let doctors = [
    {
        id: 1,
        name: "Dr. Alice Smith",
        specialty: "Cardiologist",
        image: "https://storage.googleapis.com/a1aa/image/4f01e17c-c144-4a95-1f78-b36116685610.jpg",
        description: "Expert in heart health and cardiovascular diseases with 10 years of experience.",
        available: true
    },
    // ... other doctors (same as frontend)
];

// Routes
app.get('/api/doctors', (req, res) => {
    res.json(doctors);
});

app.post('/api/appointments', (req, res) => {
    const appointment = {
        id: Date.now(),
        ...req.body,
        status: 'confirmed',
        createdAt: new Date().toISOString()
    };
    
    appointments.push(appointment);
    res.json({ success: true, appointmentId: appointment.id });
});

app.get('/api/appointments', (req, res) => {
    // Simple authentication (in production, use proper auth)
    if (req.query.password !== 'admin123') {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    res.json(appointments);
});

app.delete('/api/appointments', (req, res) => {
    if (req.query.password !== 'admin123') {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    appointments = [];
    res.json({ success: true, message: 'All appointments cleared' });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});