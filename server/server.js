const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const routes = require('./routes');
const db = require('./db'); // Initializes DB

const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json());

// API Routes
app.use('/api', routes);

// Serve Static Frontend
app.use(express.static(path.join(__dirname, '../client')));

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
