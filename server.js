const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const EXTERNAL_API_URL = 'http://4.224.186.213/evaluation-service';

app.use(cors());
app.use(express.json());

// Log incoming requests
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Mock Data for Developer Bypass Mode (Stage 6/7 images content)
const MOCK_NOTIFICATIONS = [
  { "ID": "d146095a-0d86-4a34-9e69-3900a14576bc", "Type": "Result", "Message": "mid-sem", "Timestamp": "2026-04-22 17:51:30" },
  { "ID": "b283218f-ea5a-4b7c-93a9-1f2f240d64b0", "Type": "Placement", "Message": "CSX Corporation hiring", "Timestamp": "2026-04-22 17:51:18" },
  { "ID": "81589ada-0ad3-4f77-9554-f52fb558e09d", "Type": "Event", "Message": "farewell", "Timestamp": "2026-04-22 17:51:06" },
  { "ID": "0005513a-142b-4bbc-8678-eefec65e1ede", "Type": "Result", "Message": "mid-sem", "Timestamp": "2026-04-22 17:50:54" },
  { "ID": "ea836726-c25e-4f21-a72f-544a6af8a37f", "Type": "Result", "Message": "project-review", "Timestamp": "2026-04-22 17:50:42" },
  { "ID": "003cb427-8fc6-4f77-bb00-be228f6b0d2c", "Type": "Result", "Message": "external", "Timestamp": "2026-04-22 17:50:30" },
  { "ID": "e5c4ff20-31bf-4d40-8f02-72fda59e8918", "Type": "Result", "Message": "project-review", "Timestamp": "2026-04-22 17:50:18" },
  { "ID": "1cfce5ee-ad37-4f94-8946-d707627176a5", "Type": "Event", "Message": "tech-fest", "Timestamp": "2026-04-22 17:50:06" },
  { "ID": "cf2885a6-45ac-4ba0-b548-6e9e9d4c52c8", "Type": "Result", "Message": "project-review", "Timestamp": "2026-04-22 17:49:54" },
  { "ID": "8a7412bd-6065-4d89-8581-a37f11cc848b", "Type": "Placement", "Message": "Advanced Micro Devices Inc. hiring", "Timestamp": "2026-04-22 17:49:42" },
  { "ID": "new-alert-uuid-for-test-placement", "Type": "Placement", "Message": "Google APAC Campus Hiring Open", "Timestamp": "2026-04-22 17:48:30" },
  { "ID": "new-alert-uuid-for-test-result", "Type": "Result", "Message": "End term lab evaluation results declared", "Timestamp": "2026-04-22 17:47:00" },
  { "ID": "new-alert-uuid-for-test-event", "Type": "Event", "Message": "Hackathon registrations closing tonight", "Timestamp": "2026-04-22 17:46:00" }
];

// Endpoint: Register candidate
app.post('/api/register', async (req, res) => {
  try {
    const { name, email, mobileNo, githubUsername, accessCode } = req.body;
    
    // Developer Mock Bypass
    if (accessCode === 'MOCK123') {
      return res.status(200).json({
        clientID: 'mock-client-id-jatin',
        clientSecret: 'mock-client-secret-jatin',
        message: 'Developer Mock Candidate registered successfully'
      });
    }

    const response = await fetch(`${EXTERNAL_API_URL}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, mobileNo, githubUsername, accessCode })
    });
    
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    console.error('Error in /api/register:', err.message);
    res.status(500).json({ error: 'Failed to connect to registration service' });
  }
});

// Endpoint: Authenticate candidate
app.post('/api/auth', async (req, res) => {
  try {
    const { email, name, rollNo, accessCode, clientID, clientSecret } = req.body;
    
    // Developer Mock Bypass
    if (accessCode === 'MOCK123') {
      return res.status(200).json({
        authorization_token: 'mock-jwt-token-jatin-gla-cs',
        expires_in: 3600
      });
    }

    const response = await fetch(`${EXTERNAL_API_URL}/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, name, rollNo, accessCode, clientID, clientSecret })
    });
    
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    console.error('Error in /api/auth:', err.message);
    res.status(500).json({ error: 'Failed to connect to authentication service' });
  }
});

// Helper to calculate priority weight
const getWeight = (type) => {
  const weightMap = { 'Placement': 3, 'Result': 2, 'Event': 1 };
  return weightMap[type] || 0;
};

// Endpoint: Get all notifications (Proxy with filtering and pagination)
app.get('/api/notifications', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
      return res.status(401).json({ error: 'An authorization header is required' });
    }

    const limit = parseInt(req.query.limit) || 10;
    const page = parseInt(req.query.page) || 1;
    const filterType = req.query.notification_type;

    // Developer Mock Bypass
    if (authHeader.includes('mock-jwt-token')) {
      let filtered = [...MOCK_NOTIFICATIONS];
      if (filterType) {
        filtered = filtered.filter(n => n.Type.toLowerCase() === filterType.toLowerCase());
      }
      
      const startIndex = (page - 1) * limit;
      const paginated = filtered.slice(startIndex, startIndex + limit);

      return res.json({
        notifications: paginated,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(filtered.length / limit),
          totalItems: filtered.length
        }
      });
    }

    // Forward query parameters to external API
    const queryParams = new URLSearchParams();
    if (req.query.limit) queryParams.append('limit', req.query.limit);
    if (req.query.page) queryParams.append('page', req.query.page);
    if (req.query.notification_type) queryParams.append('notification_type', req.query.notification_type);

    const url = `${EXTERNAL_API_URL}/notifications?${queryParams.toString()}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Authorization': authHeader }
    });
    
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    console.error('Error in /api/notifications:', err.message);
    res.status(500).json({ error: 'Failed to fetch notifications from external service' });
  }
});

// Endpoint: Get priority notifications (sorted by weight and timestamp)
app.get('/api/notifications/priority', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
      return res.status(401).json({ error: 'An authorization header is required' });
    }

    const limit = parseInt(req.query.limit) || 10;
    const filterType = req.query.notification_type;

    let notifications = [];

    // Developer Mock Bypass
    if (authHeader.includes('mock-jwt-token')) {
      notifications = [...MOCK_NOTIFICATIONS];
    } else {
      // Fetch all notifications from the external API to perform global priority sorting
      const response = await fetch(`${EXTERNAL_API_URL}/notifications?limit=100`, {
        method: 'GET',
        headers: { 'Authorization': authHeader }
      });

      if (!response.ok) {
        const errorData = await response.json();
        return res.status(response.status).json(errorData);
      }

      const data = await response.json();
      notifications = data.notifications || [];
    }

    // Filter by type if requested
    if (filterType) {
      notifications = notifications.filter(n => n.Type.toLowerCase() === filterType.toLowerCase());
    }

    // Priority sorting: Weight (descending) first, then Recency (timestamp descending)
    notifications.sort((a, b) => {
      const weightA = getWeight(a.Type);
      const weightB = getWeight(b.Type);

      if (weightB !== weightA) {
        return weightB - weightA;
      }
      return new Date(b.Timestamp).getTime() - new Date(a.Timestamp).getTime();
    });

    // Limit to top 'n'
    const priorityNotifications = notifications.slice(0, limit);

    res.json({
      notifications: priorityNotifications,
      totalItems: notifications.length,
      limit
    });
  } catch (err) {
    console.error('Error in /api/notifications/priority:', err.message);
    res.status(500).json({ error: 'Failed to calculate priority notifications' });
  }
});

// Endpoint: SSE stream for real-time notification alerts
app.get('/api/notifications/stream', (req, res) => {
  const authHeader = req.query.token ? `Bearer ${req.query.token}` : req.headers['authorization'];
  if (!authHeader) {
    return res.status(401).json({ error: 'Token is required for live stream' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  console.log('SSE Client connected');

  let knownNotificationIds = new Set();
  
  // Pre-populate known IDs to only notify about NEW arrivals
  if (authHeader.includes('mock-jwt-token')) {
    MOCK_NOTIFICATIONS.forEach(n => knownNotificationIds.add(n.ID));
  }

  // Poll function to check for new notifications
  const pollNotifications = async () => {
    try {
      let notifications = [];
      
      if (authHeader.includes('mock-jwt-token')) {
        // In mock mode, occasionally push a new mock notification to demonstrate live alerts
        if (Math.random() > 0.8) {
          const id = `mock-live-alert-${Date.now()}`;
          const types = ['Placement', 'Result', 'Event'];
          const randomType = types[Math.floor(Math.random() * types.length)];
          const messages = {
            'Placement': 'Microsoft has opened new Software Engineer internships!',
            'Result': 'DAA assignment grades updated.',
            'Event': 'ACM Club Tech Talk starts in 30 minutes.'
          };
          const newMock = {
            ID: id,
            Type: randomType,
            Message: messages[randomType],
            Timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19)
          };
          
          // Push to our local list so it shows up in subsequent fetches
          MOCK_NOTIFICATIONS.unshift(newMock);
          notifications = [newMock];
        }
      } else {
        const response = await fetch(`${EXTERNAL_API_URL}/notifications?limit=10`, {
          method: 'GET',
          headers: { 'Authorization': authHeader }
        });

        if (response.ok) {
          const data = await response.json();
          notifications = data.notifications || [];
        }
      }
      
      // Check for new notifications
      const newNotifications = [];
      for (const n of notifications) {
        if (!knownNotificationIds.has(n.ID)) {
          newNotifications.push(n);
          knownNotificationIds.add(n.ID);
        }
      }

      // Push new notifications to the client
      if (newNotifications.length > 0) {
        res.write(`data: ${JSON.stringify({ newNotifications })}\n\n`);
      }
    } catch (err) {
      console.error('Error in SSE polling:', err.message);
    }
  };

  // Initial poll and set interval
  pollNotifications();
  const intervalId = setInterval(pollNotifications, 10000);

  req.on('close', () => {
    console.log('SSE Client disconnected');
    clearInterval(intervalId);
    res.end();
  });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
