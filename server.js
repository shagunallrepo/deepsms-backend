const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const mongoose = require('mongoose');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

mongoose.connect(process.env.MONGODB_URI || "mongodb+srv://unlimitedgmail1xx_db_user:uP6uxQfbeBiVospm@cluster0.kc2160t.mongodb.net/deepsms?retryWrites=true&w=majority")
  .then(() => console.log("MongoDB Connected"))
  .catch(err => console.log(err));

const Manager = mongoose.model('Manager', new mongoose.Schema({
    username: { type: String, required: true },
    password: { type: String, required: true }
}));

// Paste it right here:
const Settings = mongoose.model('Settings', new mongoose.Schema({
    type: { type: String, default: 'api-links' },
    links: [String]
}));

// Paste the new User model right here:
const User = mongoose.model('User', new mongoose.Schema({
    username: { type: String, required: true },
    password: { type: String, required: true }
}));

let globalApiLink = "";
let accountRequests = [];
let ranges = [];
let userNumbers = [];

// --- MANAGER CLONER ---
app.post('/api/verify-login', async (req, res) => {
    const { username, password } = req.body;

    // 1. Check Master Manager
    if (username === "Kite" && password === "prince") {
        return res.json({ success: true, isManager: true });
    }

    // 2. Check Cloned Managers
    const manager = await Manager.findOne({ username, password });
    if (manager) {
        return res.json({ success: true, isManager: true });
    }

    // 3. Check Approved Regular Users
    const user = await User.findOne({ username, password });
    if (user) {
        return res.json({ success: true, isManager: false });
    }

    // 4. Reject all invalid credentials
    return res.status(401).json({ success: false, message: "Invalid username or password" });
});

app.post('/api/add-manager', async (req, res) => {
    const { username, password } = req.body;
    const newManager = new Manager({ username, password });
    await newManager.save();
    res.json({ success: true, message: "Manager saved permanently!" });
});

// --- API LINKS (Up to 10) ---
app.post('/api/approve-user', async (req, res) => {
    const { username, password } = req.body;
    const newUser = new User({ username, password });
    await newUser.save();
    res.json({ success: true, message: "User approved and saved permanently!" });
});

app.get('/api/settings/api-link', async (req, res) => {
    const settings = await Settings.findOne({ type: 'api-links' });
    res.json({ links: settings ? settings.links : [] });
});

app.post('/api/settings/api-link', async (req, res) => {
    const { links } = req.body;
    let settings = await Settings.findOne({ type: 'api-links' });
    if (!settings) {
        settings = new Settings({ type: 'api-links', links: links });
    } else {
        settings.links = links;
    }
    await settings.save();
    res.json({ success: true, message: "APIs saved permanently to database!" });
});

// --- LIVE TRAFFIC (Fetching from multiple URLs) ---
app.get('/api/live-traffic', async (req, res) => {
    try {
        // 1. Fetch the saved API links from your MongoDB database
        const settings = await Settings.findOne({ type: 'api-links' });
        
        // Filter out any blank inputs so it only runs actual URLs
        const activeLinks = settings && settings.links ? settings.links.filter(url => url && url.trim() !== '') : [];

        if (activeLinks.length === 0) {
            return res.json({ success: true, data: [] });
        }

        let allTrafficData = [];

        // 2. Loop through every saved API link and fetch the data using axios
        for (const link of activeLinks) {
            try {
                const response = await axios.get(link);
                
                // Extract the data array (handles APIs that return raw arrays or { data: [...] })
                const apiData = Array.isArray(response.data) ? response.data : (response.data.data || []);
                
                allTrafficData = allTrafficData.concat(apiData);
            } catch (fetchError) {
                console.error(`Error fetching from link ${link}:`, fetchError.message);
                // Continues checking the other links even if one is broken
            }
        }
});
        
        // Sort by date descending
        allTraffic.sort((a, b) => new Date(b.dt) - new Date(a.dt));
        res.json({ data: allTraffic });
    } catch (err) {
        res.json({ data: [] });
    }
});

// --- USER MY SMS ---
app.get('/api/my-sms/:username', async (req, res) => {
    const username = req.params.username;
    if (!globalApiLink) return res.json({ data: [] });

    // Find prefixes owned by this user
    const userOwned = userNumbers.filter(u => u.username === username);
    let myPrefixes = [];
    userOwned.forEach(record => {
        if (!myPrefixes.includes(record.prefix)) myPrefixes.push(record.prefix);
    });

    try {
        const urls = globalApiLink.split(',').filter(url => url.trim() !== '');
        let allTraffic = [];
        const requests = urls.map(url => axios.get(url.trim()).catch(err => null));
        const responses = await Promise.all(requests);
        
        responses.forEach(response => {
            if (response && response.data && response.data.data) {
                allTraffic = allTraffic.concat(response.data.data);
            }
        });

        // Filter traffic to only show numbers matching the user's prefixes
        const filteredTraffic = allTraffic.filter(msg => {
            return myPrefixes.some(prefix => String(msg.num).startsWith(prefix));
        });

        res.json({ data: filteredTraffic });
    } catch (err) {
        res.json({ data: [] });
    }
});

// --- ACCOUNT REQUESTS ---
app.post('/api/request-account', (req, res) => {
    accountRequests.push({ id: uuidv4(), ...req.body, date: new Date().toLocaleString() });
    res.json({ success: true, message: "Account requested! Pending manager approval." });
});
app.get('/api/account-requests', (req, res) => res.json(accountRequests));
app.delete('/api/account-requests/:id', (req, res) => {
    accountRequests = accountRequests.filter(r => r.id !== req.params.id);
    res.json({ success: true });
});

// --- RANGES ---
app.get('/api/ranges', (req, res) => res.json(ranges));
app.post('/api/ranges', (req, res) => {
    const { name, prefix, numbers } = req.body;
    ranges.push({ id: uuidv4(), name, prefix, numbers, testNum: numbers[0] || "N/A", currency: "USD", availableCount: numbers.length });
    res.json({ success: true, message: "Range added successfully!" });
});
app.delete('/api/ranges/:id', (req, res) => {
    ranges = ranges.filter(r => r.id !== req.params.id);
    res.json({ success: true });
});

// --- CLAIM NUMBERS ---
app.post('/api/request-numbers', (req, res) => {
    const { username, prefix, quantity } = req.body;
    const rangeIndex = ranges.findIndex(r => r.prefix === prefix);
    
    if (rangeIndex === -1) return res.status(400).json({ success: false, message: "Range not found." });
    
    const range = ranges[rangeIndex];
    if (range.numbers.length < quantity) return res.status(400).json({ success: false, message: "Not enough numbers available." });

    const claimedNumbers = range.numbers.splice(0, quantity);
    range.availableCount = range.numbers.length;

    userNumbers.push({
        id: uuidv4(), username, rangeName: range.name, prefix: range.prefix, numbers: claimedNumbers, date: new Date().toLocaleString()
    });

    res.json({ success: true, message: `Successfully claimed ${quantity} numbers!` });
});

// --- MANAGE NUMBERS ---
app.get('/api/all-numbers', (req, res) => res.json(userNumbers));
app.get('/api/my-numbers/:username', (req, res) => {
    res.json(userNumbers.filter(n => n.username === req.params.username));
});
app.delete('/api/user-numbers/:id', (req, res) => {
    userNumbers = userNumbers.filter(n => n.id !== req.params.id);
    res.json({ success: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
