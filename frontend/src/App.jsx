import React, { useState, useEffect, useRef } from 'react';
import { 
  Box, 
  Container, 
  Grid, 
  Card, 
  CardContent, 
  Typography, 
  Button, 
  TextField, 
  Select, 
  MenuItem, 
  FormControl, 
  InputLabel, 
  Tabs, 
  Tab, 
  Badge, 
  CircularProgress, 
  Alert, 
  Snackbar, 
  List, 
  ListItem, 
  ListItemText, 
  ListItemIcon, 
  IconButton, 
  Chip,
  Paper,
  Divider,
  Pagination
} from '@mui/material';
import {
  Notifications as BellIcon,
  PriorityHigh as PriorityIcon,
  CheckCircle as CheckedIcon,
  Login as LoginIcon,
  PersonAdd as RegisterIcon,
  ExitToApp as LogoutIcon,
  LiveTv as LiveIcon,
  FolderOpen as FolderIcon,
  SignalCellularAlt as StatsIcon
} from '@mui/icons-material';

export default function App() {
  // Authentication state
  const [token, setToken] = useState(localStorage.getItem('affordmed_token') || '');
  const [candidateInfo, setCandidateInfo] = useState(JSON.parse(localStorage.getItem('affordmed_candidate')) || null);
  const [isRegisterMode, setIsRegisterMode] = useState(false);

  // Forms state
  const [loginForm, setLoginForm] = useState({
    name: 'Jatin Pratap Singh',
    email: 'jatin.singh_cs23@gla.ac.in',
    rollNo: '2315001017',
    accessCode: '',
    clientID: localStorage.getItem('affordmed_client_id') || '',
    clientSecret: localStorage.getItem('affordmed_client_secret') || ''
  });

  const [registerForm, setRegisterForm] = useState({
    name: 'Jatin Pratap Singh',
    email: 'jatin.singh_cs23@gla.ac.in',
    mobileNo: '9897759217',
    githubUsername: 'jadaun0079',
    accessCode: ''
  });

  // Notifications feed state
  const [notifications, setNotifications] = useState([]);
  const [priorityNotifications, setPriorityNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Pagination & Filtering state
  const [activeTab, setActiveTab] = useState(0); // 0: Dashboard, 1: All Notifications, 2: Priority Inbox
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [limit, setLimit] = useState(10);
  const [filterType, setFilterType] = useState(''); // '', 'Event', 'Result', 'Placement'
  const [priorityLimit, setPriorityLimit] = useState(10); // 10, 15, 20

  // Viewed/Read tracking state (Frontend suitable implementation as per Stage 7)
  const [viewedIds, setViewedIds] = useState(JSON.parse(localStorage.getItem('viewed_notifications')) || []);

  // Live stream notification alert state
  const [liveAlert, setLiveAlert] = useState(null);
  const [sseConnected, setSseConnected] = useState(false);
  const sseSource = useRef(null);

  // Auto-connect to SSE on token availability
  useEffect(() => {
    if (token) {
      connectSSE();
      fetchDashboardData();
    } else {
      disconnectSSE();
    }
    return () => disconnectSSE();
  }, [token]);

  // Fetch data whenever filters or tab changes
  useEffect(() => {
    if (token) {
      if (activeTab === 1) {
        fetchAllNotifications();
      } else if (activeTab === 2) {
        fetchPriorityNotifications();
      }
    }
  }, [activeTab, page, limit, filterType, priorityLimit]);

  // Persist viewed IDs to localStorage
  useEffect(() => {
    localStorage.setItem('viewed_notifications', JSON.stringify(viewedIds));
  }, [viewedIds]);

  const connectSSE = () => {
    if (sseSource.current) return;
    
    console.log('Connecting to SSE stream...');
    const url = `http://localhost:5000/api/notifications/stream?token=${encodeURIComponent(token)}`;
    sseSource.current = new EventSource(url);

    sseSource.current.onopen = () => {
      setSseConnected(true);
      console.log('SSE Stream established');
    };

    sseSource.current.onerror = (e) => {
      console.error('SSE connection error:', e);
      setSseConnected(false);
    };

    sseSource.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.newNotifications && data.newNotifications.length > 0) {
          const latest = data.newNotifications[0];
          setLiveAlert(latest);
          
          // Refresh lists
          if (activeTab === 1) fetchAllNotifications();
          if (activeTab === 2) fetchPriorityNotifications();
          fetchDashboardData();
        }
      } catch (err) {
        console.error('Error parsing SSE event:', err);
      }
    };
  };

  const disconnectSSE = () => {
    if (sseSource.current) {
      sseSource.current.close();
      sseSource.current = null;
      setSseConnected(false);
      console.log('SSE Stream disconnected');
    }
  };

  const fetchDashboardData = async () => {
    try {
      const res = await fetch('/api/notifications?limit=100', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
      }
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    }
  };

  const fetchAllNotifications = async () => {
    setLoading(true);
    setError('');
    try {
      const query = new URLSearchParams({
        page,
        limit,
        ...(filterType && { notification_type: filterType })
      });
      const res = await fetch(`/api/notifications?${query.toString()}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setNotifications(data.notifications || []);
        setTotalPages(data.pagination?.totalPages || 1);
      } else {
        setError(data.error || 'Failed to fetch notifications');
      }
    } catch (err) {
      setError('Connection failure to backend server');
    } finally {
      setLoading(false);
    }
  };

  const fetchPriorityNotifications = async () => {
    setLoading(true);
    setError('');
    try {
      const query = new URLSearchParams({
        limit: priorityLimit,
        ...(filterType && { notification_type: filterType })
      });
      const res = await fetch(`/api/notifications/priority?${query.toString()}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setPriorityNotifications(data.notifications || []);
      } else {
        setError(data.error || 'Failed to fetch priority notifications');
      }
    } catch (err) {
      setError('Connection failure to backend server');
    } finally {
      setLoading(false);
    }
  };

  // Actions
  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(registerForm)
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('affordmed_client_id', data.clientID);
        localStorage.setItem('affordmed_client_secret', data.clientSecret);
        setLoginForm(prev => ({
          ...prev,
          clientID: data.clientID,
          clientSecret: data.clientSecret,
          accessCode: registerForm.accessCode
        }));
        setIsRegisterMode(false);
        setLiveAlert({ Type: 'Result', Message: 'Registration successful! Credentials saved.' });
      } else {
        setError(data.errors ? JSON.stringify(data.errors) : data.error || 'Registration failed');
      }
    } catch (err) {
      setError('Connection error to backend server');
    } finally {
      setLoading(false);
    }
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm)
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('affordmed_token', data.authorization_token);
        localStorage.setItem('affordmed_candidate', JSON.stringify({
          name: loginForm.name,
          email: loginForm.email,
          rollNo: loginForm.rollNo
        }));
        setToken(data.authorization_token);
        setCandidateInfo({
          name: loginForm.name,
          email: loginForm.email,
          rollNo: loginForm.rollNo
        });
      } else {
        setError(data.errors ? JSON.stringify(data.errors) : data.error || 'Authentication failed');
      }
    } catch (err) {
      setError('Connection error to backend server');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('affordmed_token');
    localStorage.removeItem('affordmed_candidate');
    setToken('');
    setCandidateInfo(null);
    setNotifications([]);
    setPriorityNotifications([]);
    disconnectSSE();
  };

  const markAsViewed = (id) => {
    if (!viewedIds.includes(id)) {
      setViewedIds(prev => [...prev, id]);
    }
  };

  const markAllAsViewed = () => {
    const ids = notifications.map(n => n.ID);
    setViewedIds(prev => Array.from(new Set([...prev, ...ids])));
  };

  const clearViewedHistory = () => {
    setViewedIds([]);
  };

  // Helper colors mapping for priorities
  const getTypeColor = (type) => {
    if (type === 'Placement') return '#ff2e54'; // Crimson
    if (type === 'Result') return '#ffa000'; // Amber/Gold
    return '#29b6f6'; // Sky Blue
  };

  const unreadCount = notifications.filter(n => !viewedIds.includes(n.ID)).length;

  if (!token) {
    return (
      <Container maxWidth="sm" sx={{ mt: 10, mb: 10 }}>
        <Paper elevation={6} sx={{ p: 4, background: 'rgba(17, 20, 27, 0.8)', backdropFilter: 'blur(16px)', position: 'relative', overflow: 'hidden' }}>
          {/* Glassmorphism Background Accent */}
          <Box sx={{
            position: 'absolute',
            top: -50,
            right: -50,
            width: 150,
            height: 150,
            background: 'linear-gradient(45deg, #00d2ff, #9d4edd)',
            filter: 'blur(60px)',
            borderRadius: '50%',
            opacity: 0.3
          }} />

          <Box textAlign="center" mb={4}>
            <BellIcon sx={{ fontSize: 50, color: '#00d2ff', mb: 1 }} />
            <Typography variant="h4" component="h1" gutterBottom sx={{ background: 'linear-gradient(45deg, #00d2ff, #9d4edd)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Affordmed Recruitment Portal
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Notification & Priority Inbox Service
            </Typography>
          </Box>

          {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

          {isRegisterMode ? (
            <form onSubmit={handleRegisterSubmit}>
              <Typography variant="h6" gutterBottom display="flex" alignItems="center">
                <RegisterIcon sx={{ mr: 1, color: '#00d2ff' }} /> Candidate Registration
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField fullWidth label="Full Name" required value={registerForm.name} onChange={e => setRegisterForm({...registerForm, name: e.target.value})} />
                </Grid>
                <Grid item xs={12}>
                  <TextField fullWidth type="email" label="Email Address" required value={registerForm.email} onChange={e => setRegisterForm({...registerForm, email: e.target.value})} />
                </Grid>
                <Grid item xs={6}>
                  <TextField fullWidth label="Mobile Number" required value={registerForm.mobileNo} onChange={e => setRegisterForm({...registerForm, mobileNo: e.target.value})} />
                </Grid>
                <Grid item xs={6}>
                  <TextField fullWidth label="GitHub Username" required value={registerForm.githubUsername} onChange={e => setRegisterForm({...registerForm, githubUsername: e.target.value})} />
                </Grid>
                <Grid item xs={12}>
                  <TextField fullWidth type="password" label="Access Code" required placeholder="Enter recruitment access code" value={registerForm.accessCode} onChange={e => setRegisterForm({...registerForm, accessCode: e.target.value})} />
                </Grid>
                <Grid item xs={12}>
                  <Button fullWidth variant="contained" type="submit" disabled={loading} sx={{ mt: 1, background: 'linear-gradient(45deg, #00d2ff, #0093b2)' }}>
                    {loading ? <CircularProgress size={24} /> : 'Register Candidate'}
                  </Button>
                </Grid>
              </Grid>
              <Box mt={3} textAlign="center">
                <Typography variant="body2">
                  Already registered?{' '}
                  <Button variant="text" size="small" onClick={() => setIsRegisterMode(false)}>
                    Login Now
                  </Button>
                </Typography>
              </Box>
            </form>
          ) : (
            <form onSubmit={handleLoginSubmit}>
              <Typography variant="h6" gutterBottom display="flex" alignItems="center">
                <LoginIcon sx={{ mr: 1, color: '#00d2ff' }} /> Candidate Login
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField fullWidth label="Full Name" required value={loginForm.name} onChange={e => setLoginForm({...loginForm, name: e.target.value})} />
                </Grid>
                <Grid item xs={12}>
                  <TextField fullWidth type="email" label="Email Address" required value={loginForm.email} onChange={e => setLoginForm({...loginForm, email: e.target.value})} />
                </Grid>
                <Grid item xs={12}>
                  <TextField fullWidth label="University Roll Number" required value={loginForm.rollNo} onChange={e => setLoginForm({...loginForm, rollNo: e.target.value})} />
                </Grid>
                <Grid item xs={12}>
                  <TextField fullWidth type="password" label="Recruitment Access Code" required value={loginForm.accessCode} onChange={e => setLoginForm({...loginForm, accessCode: e.target.value})} />
                </Grid>
                <Grid item xs={12}>
                  <TextField fullWidth label="Client ID (Optional if saved)" placeholder="Paste Client ID if already registered" value={loginForm.clientID} onChange={e => setLoginForm({...loginForm, clientID: e.target.value})} />
                </Grid>
                <Grid item xs={12}>
                  <TextField fullWidth type="password" label="Client Secret (Optional if saved)" placeholder="Paste Client Secret" value={loginForm.clientSecret} onChange={e => setLoginForm({...loginForm, clientSecret: e.target.value})} />
                </Grid>
                <Grid item xs={12}>
                  <Button fullWidth variant="contained" type="submit" disabled={loading} sx={{ mt: 1, background: 'linear-gradient(45deg, #00d2ff, #0093b2)' }}>
                    {loading ? <CircularProgress size={24} /> : 'Authenticate & Enter'}
                  </Button>
                </Grid>
              </Grid>
              <Box mt={3} textAlign="center">
                <Typography variant="body2">
                  First time?{' '}
                  <Button variant="text" size="small" onClick={() => setIsRegisterMode(true)}>
                    Register to get clientID/clientSecret
                  </Button>
                </Typography>
              </Box>
            </form>
          )}
        </Paper>
      </Container>
    );
  }

  return (
    <Box>
      {/* Header / Navbar Component */}
      <Box sx={{ borderBottom: 1, borderColor: 'rgba(255, 255, 255, 0.08)', bg: '#0d0f14', py: 1 }}>
        <Container maxWidth="lg">
          <Grid container alignItems="center" justifyContent="space-between">
            <Grid item display="flex" alignItems="center" gap={1.5}>
              <BellIcon sx={{ color: '#00d2ff', fontSize: 32 }} />
              <Typography variant="h5" component="h2" sx={{ fontFamily: 'Outfit', fontWeight: 700, letterSpacing: 0.5 }}>
                AFFORDMED <Typography component="span" sx={{ fontSize: 13, color: '#00d2ff', border: '1px solid #00d2ff', px: 1, py: 0.2, borderRadius: 1.5, ml: 1, verticalAlign: 'middle' }}>STUDENT PORTAL</Typography>
              </Typography>
            </Grid>

            {candidateInfo && (
              <Grid item display="flex" alignItems="center" gap={3}>
                <Box textAlign="right" display={{ xs: 'none', md: 'block' }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>{candidateInfo.name}</Typography>
                  <Typography variant="caption" color="textSecondary">{candidateInfo.email} | Roll: {candidateInfo.rollNo}</Typography>
                </Box>
                <Chip 
                  icon={<LiveIcon style={{ color: sseConnected ? '#ff2e54' : '#9ca3af' }} />} 
                  label={sseConnected ? "Live Stream: Connected" : "Live Stream: Offline"} 
                  color={sseConnected ? "success" : "default"} 
                  variant="outlined" 
                  size="small"
                />
                <Button size="small" color="inherit" variant="outlined" startIcon={<LogoutIcon />} onClick={handleLogout}>
                  Logout
                </Button>
              </Grid>
            )}
          </Grid>
        </Container>
      </Box>

      {/* Tabs / Subheader Navigation */}
      <Container maxWidth="lg" sx={{ mt: 3 }}>
        <Paper elevation={0} sx={{ borderBottom: 1, borderColor: 'rgba(255, 255, 255, 0.08)', borderRadius: 0, backgroundColor: 'transparent' }}>
          <Tabs value={activeTab} onChange={(e, val) => { setActiveTab(val); setPage(1); }} textColor="primary" indicatorColor="primary">
            <Tab label="Dashboard / Stats" icon={<StatsIcon />} iconPosition="start" />
            <Tab 
              label={
                <Badge badgeContent={unreadCount} color="error" max={99}>
                  <span style={{ paddingRight: unreadCount > 0 ? 12 : 0 }}>All Notifications</span>
                </Badge>
              } 
              icon={<BellIcon />} 
              iconPosition="start" 
            />
            <Tab label="Priority Inbox" icon={<PriorityIcon />} iconPosition="start" />
          </Tabs>
        </Paper>
      </Container>

      {/* Main Content Layout */}
      <Container maxWidth="lg" sx={{ mt: 3, mb: 8 }}>
        {/* SSE Incoming Toast Notification */}
        <Snackbar 
          open={!!liveAlert} 
          autoHideDuration={6000} 
          onClose={() => setLiveAlert(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        >
          {liveAlert && (
            <Alert 
              onClose={() => setLiveAlert(null)} 
              severity={liveAlert.Type === 'Placement' ? 'error' : liveAlert.Type === 'Result' ? 'warning' : 'info'}
              variant="filled"
              sx={{ width: '100%', borderRadius: 3 }}
            >
              <Typography variant="subtitle2" fontWeight={600}>New {liveAlert.Type} Notification Alert!</Typography>
              <Typography variant="body2">{liveAlert.Message}</Typography>
            </Alert>
          )}
        </Snackbar>

        {activeTab === 0 && (
          <Grid container spacing={3}>
            {/* Stats Dashboard */}
            <Grid item xs={12} md={4}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Typography variant="h6" color="textSecondary" gutterBottom>Notifications Feed Summary</Typography>
                  <Box display="flex" alignItems="baseline" gap={1} my={2}>
                    <Typography variant="h2" component="p" sx={{ fontWeight: 800 }}>{notifications.length}</Typography>
                    <Typography variant="subtitle1" color="textSecondary">total items</Typography>
                  </Box>
                  <Divider sx={{ my: 2 }} />
                  <Box display="flex" justifyContent="space-between" mb={1}>
                    <Typography variant="body2">Unread Priority Items:</Typography>
                    <Typography variant="body2" fontWeight={700} color="error.main">
                      {notifications.filter(n => !viewedIds.includes(n.ID) && n.Type === 'Placement').length}
                    </Typography>
                  </Box>
                  <Box display="flex" justifyContent="space-between" mb={1}>
                    <Typography variant="body2">Unread Results:</Typography>
                    <Typography variant="body2" fontWeight={700} color="warning.main">
                      {notifications.filter(n => !viewedIds.includes(n.ID) && n.Type === 'Result').length}
                    </Typography>
                  </Box>
                  <Box display="flex" justifyContent="space-between">
                    <Typography variant="body2">Unread Events:</Typography>
                    <Typography variant="body2" fontWeight={700} color="info.main">
                      {notifications.filter(n => !viewedIds.includes(n.ID) && n.Type === 'Event').length}
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={4}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Typography variant="h6" color="textSecondary" gutterBottom>Reading Progress</Typography>
                  <Box display="flex" alignItems="baseline" gap={1} my={2}>
                    <Typography variant="h2" component="p" sx={{ fontWeight: 800 }}>
                      {notifications.length > 0 ? Math.round((viewedIds.length / notifications.length) * 100) : 0}%
                    </Typography>
                    <Typography variant="subtitle1" color="textSecondary">read rate</Typography>
                  </Box>
                  <Divider sx={{ my: 2 }} />
                  <Box display="flex" gap={1.5} flexWrap="wrap">
                    <Button variant="outlined" size="small" startIcon={<CheckedIcon />} onClick={markAllAsViewed}>
                      Mark All Read
                    </Button>
                    <Button variant="text" size="small" color="textSecondary" onClick={clearViewedHistory}>
                      Reset History
                    </Button>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={4}>
              <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <CardContent>
                  <Typography variant="h6" color="textSecondary" gutterBottom>Live Sync status</Typography>
                  <Box display="flex" alignItems="center" gap={1.5} my={2}>
                    <Box sx={{
                      width: 12,
                      height: 12,
                      borderRadius: '50%',
                      backgroundColor: sseConnected ? 'success.main' : 'text.secondary',
                      boxShadow: sseConnected ? '0 0 10px rgba(46, 125, 50, 0.8)' : 'none',
                      animation: sseConnected ? 'pulse 2s infinite' : 'none',
                      '@keyframes pulse': {
                        '0%': { transform: 'scale(0.95)', boxShadow: '0 0 0 0 rgba(46, 125, 50, 0.7)' },
                        '70%': { transform: 'scale(1)', boxShadow: '0 0 0 10px rgba(46, 125, 50, 0)' },
                        '100%': { transform: 'scale(0.95)', boxShadow: '0 0 0 0 rgba(46, 125, 50, 0)' },
                      }
                    }} />
                    <Typography variant="h5" sx={{ fontWeight: 700 }}>
                      {sseConnected ? 'Real-Time SSE Active' : 'Polling Backend'}
                    </Typography>
                  </Box>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="caption" color="textSecondary">
                    The portal connects directly via a Server-Sent Events stream to proxy live server alerts instantly to your dashboard.
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            {/* Quick Overview Recent List */}
            <Grid item xs={12}>
              <Paper sx={{ p: 3, backgroundColor: 'rgba(22, 28, 36, 0.4)' }}>
                <Typography variant="h6" gutterBottom display="flex" alignItems="center" gap={1}>
                  <BellIcon color="primary" /> Recent Alerts Feed
                </Typography>
                <Divider sx={{ mb: 2 }} />
                {notifications.length === 0 ? (
                  <Typography color="textSecondary" py={3} textAlign="center">No notifications available. Head to 'All Notifications' tab to pull latest updates.</Typography>
                ) : (
                  <List>
                    {notifications.slice(0, 5).map((item) => (
                      <ListItem 
                        key={item.ID} 
                        sx={{ 
                          mb: 1, 
                          borderRadius: 2, 
                          backgroundColor: 'rgba(255, 255, 255, 0.02)',
                          borderLeft: `5px solid ${getTypeColor(item.Type)}`,
                          '&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.04)' }
                        }}
                      >
                        <ListItemText 
                          primary={item.Message} 
                          secondary={`${item.Type} • ${item.Timestamp}`} 
                          primaryTypographyProps={{ fontWeight: viewedIds.includes(item.ID) ? 400 : 700 }}
                        />
                        <Chip label={item.Type} size="small" sx={{ borderColor: getTypeColor(item.Type), color: getTypeColor(item.Type) }} variant="outlined" />
                      </ListItem>
                    ))}
                  </List>
                )}
              </Paper>
            </Grid>
          </Grid>
        )}

        {activeTab === 1 && (
          <Box>
            {/* Filter Drawer / Controls */}
            <Card sx={{ mb: 3 }}>
              <CardContent sx={{ py: 2, '&:last-child': { pb: 2 } }}>
                <Grid container spacing={2} alignItems="center">
                  <Grid item xs={12} sm={4}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Filter by Notification Type</InputLabel>
                      <Select 
                        value={filterType} 
                        label="Filter by Notification Type" 
                        onChange={e => { setFilterType(e.target.value); setPage(1); }}
                      >
                        <MenuItem value="">All Types (Placement, Result, Event)</MenuItem>
                        <MenuItem value="Placement">Placement Notifications</MenuItem>
                        <MenuItem value="Result">Result Notifications</MenuItem>
                        <MenuItem value="Event">Event Notifications</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} sm={3}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Items Per Page</InputLabel>
                      <Select 
                        value={limit} 
                        label="Items Per Page" 
                        onChange={e => { setLimit(e.target.value); setPage(1); }}
                      >
                        <MenuItem value={5}>5 items</MenuItem>
                        <MenuItem value={10}>10 items</MenuItem>
                        <MenuItem value={20}>20 items</MenuItem>
                        <MenuItem value={50}>50 items</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} sm={5} display="flex" justifyContent="flex-end" gap={1}>
                    <Button variant="outlined" size="small" onClick={markAllAsViewed}>
                      Mark All Viewed
                    </Button>
                    <Button variant="text" size="small" color="inherit" onClick={() => { setFilterType(''); setPage(1); }}>
                      Clear Filters
                    </Button>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>

            {/* Notifications Feed */}
            {loading ? (
              <Box textAlign="center" py={10}><CircularProgress /></Box>
            ) : error ? (
              <Alert severity="error" sx={{ my: 2 }}>{error}</Alert>
            ) : notifications.length === 0 ? (
              <Paper sx={{ p: 5, textAlign: 'center' }}>
                <FolderIcon sx={{ fontSize: 50, color: 'text.secondary', mb: 2 }} />
                <Typography color="textSecondary">No notifications matched your filters.</Typography>
              </Paper>
            ) : (
              <Box>
                <Grid container spacing={2}>
                  {notifications.map((item) => {
                    const isNew = !viewedIds.includes(item.ID);
                    return (
                      <Grid item xs={12} key={item.ID}>
                        <Card 
                          onClick={() => markAsViewed(item.ID)}
                          sx={{ 
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            position: 'relative',
                            borderLeft: `6px solid ${getTypeColor(item.Type)}`,
                            backgroundColor: isNew ? 'rgba(255, 255, 255, 0.04)' : 'rgba(22, 28, 36, 0.3)',
                            '&:hover': {
                              backgroundColor: isNew ? 'rgba(255, 255, 255, 0.06)' : 'rgba(255, 255, 255, 0.02)',
                              transform: 'translateX(4px)'
                            }
                          }}
                        >
                          {/* Unread Glowing Dot Indicator */}
                          {isNew && (
                            <Box sx={{
                              position: 'absolute',
                              top: 15,
                              right: 15,
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              backgroundColor: '#00d2ff',
                              boxShadow: '0 0 8px #00d2ff'
                            }} />
                          )}
                          <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
                            <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                              <Chip 
                                label={item.Type} 
                                size="small" 
                                sx={{ 
                                  backgroundColor: 'transparent', 
                                  borderColor: getTypeColor(item.Type), 
                                  color: getTypeColor(item.Type),
                                  fontWeight: 600
                                }} 
                                variant="outlined" 
                              />
                              <Typography variant="caption" color="textSecondary">{item.Timestamp}</Typography>
                            </Box>
                            <Typography 
                              variant="body1" 
                              sx={{ 
                                fontWeight: isNew ? 600 : 400,
                                color: isNew ? '#ffffff' : '#9ca3af'
                              }}
                            >
                              {item.Message}
                            </Typography>
                          </CardContent>
                        </Card>
                      </Grid>
                    );
                  })}
                </Grid>

                {/* Pagination footer */}
                <Box display="flex" justifyContent="center" mt={4}>
                  <Pagination 
                    count={totalPages} 
                    page={page} 
                    onChange={(e, val) => setPage(val)} 
                    color="primary" 
                    size="medium"
                  />
                </Box>
              </Box>
            )}
          </Box>
        )}

        {activeTab === 2 && (
          <Box>
            {/* Priority Control Bar */}
            <Card sx={{ mb: 3 }}>
              <CardContent sx={{ py: 2, '&:last-child': { pb: 2 } }}>
                <Grid container spacing={2} alignItems="center">
                  <Grid item xs={12} sm={4}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Display Top 'n' Items</InputLabel>
                      <Select 
                        value={priorityLimit} 
                        label="Display Top 'n' Items" 
                        onChange={e => setPriorityLimit(e.target.value)}
                      >
                        <MenuItem value={10}>Top 10 Notifications</MenuItem>
                        <MenuItem value={15}>Top 15 Notifications</MenuItem>
                        <MenuItem value={20}>Top 20 Notifications</MenuItem>
                        <MenuItem value={30}>Top 30 Notifications</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Type Sub-Filter</InputLabel>
                      <Select 
                        value={filterType} 
                        label="Type Sub-Filter" 
                        onChange={e => setFilterType(e.target.value)}
                      >
                        <MenuItem value="">Show All (Sorted by Weight)</MenuItem>
                        <MenuItem value="Placement">Only Placements (Weight: 3)</MenuItem>
                        <MenuItem value="Result">Only Results (Weight: 2)</MenuItem>
                        <MenuItem value="Event">Only Events (Weight: 1)</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} sm={4} display="flex" justifyContent="flex-end">
                    <Typography variant="body2" color="textSecondary" display="flex" alignItems="center" gap={0.5}>
                      <PriorityIcon color="error" fontSize="small" /> Weights: Placement (3) &gt; Result (2) &gt; Event (1)
                    </Typography>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>

            {/* Priority Notifications Stream List */}
            {loading ? (
              <Box textAlign="center" py={10}><CircularProgress /></Box>
            ) : error ? (
              <Alert severity="error" sx={{ my: 2 }}>{error}</Alert>
            ) : priorityNotifications.length === 0 ? (
              <Paper sx={{ p: 5, textAlign: 'center' }}>
                <PriorityIcon sx={{ fontSize: 50, color: 'text.secondary', mb: 2 }} />
                <Typography color="textSecondary">No priority items fit your configuration.</Typography>
              </Paper>
            ) : (
              <Box>
                <Grid container spacing={2}>
                  {priorityNotifications.map((item, index) => {
                    const isNew = !viewedIds.includes(item.ID);
                    return (
                      <Grid item xs={12} key={item.ID}>
                        <Card 
                          onClick={() => markAsViewed(item.ID)}
                          sx={{ 
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            position: 'relative',
                            borderLeft: `6px solid ${getTypeColor(item.Type)}`,
                            backgroundColor: isNew ? 'rgba(255, 255, 255, 0.04)' : 'rgba(22, 28, 36, 0.3)',
                            '&:hover': {
                              backgroundColor: isNew ? 'rgba(255, 255, 255, 0.06)' : 'rgba(255, 255, 255, 0.02)',
                              transform: 'translateX(4px)'
                            }
                          }}
                        >
                          <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 }, display: 'flex', alignItems: 'center', gap: 2 }}>
                            {/* Rank Indicator */}
                            <Box sx={{
                              width: 36,
                              height: 36,
                              borderRadius: '50%',
                              border: '2px solid rgba(255, 255, 255, 0.12)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              backgroundColor: index < 3 ? 'rgba(0, 210, 255, 0.1)' : 'transparent',
                              borderColor: index < 3 ? '#00d2ff' : 'rgba(255, 255, 255, 0.12)'
                            }}>
                              <Typography variant="body2" fontWeight={700} color={index < 3 ? '#00d2ff' : 'textSecondary'}>
                                #{index + 1}
                              </Typography>
                            </Box>
                            
                            <Box flex={1}>
                              <Box display="flex" justifyContent="space-between" alignItems="center" mb={0.5}>
                                <Box display="flex" alignItems="center" gap={1}>
                                  <Chip 
                                    label={item.Type} 
                                    size="small" 
                                    sx={{ 
                                      backgroundColor: 'transparent', 
                                      borderColor: getTypeColor(item.Type), 
                                      color: getTypeColor(item.Type),
                                      fontWeight: 600
                                    }} 
                                    variant="outlined" 
                                  />
                                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>Weight: {getWeight(item.Type)}</Typography>
                                </Box>
                                <Typography variant="caption" color="textSecondary">{item.Timestamp}</Typography>
                              </Box>
                              <Typography 
                                variant="body1" 
                                sx={{ 
                                  fontWeight: isNew ? 600 : 400,
                                  color: isNew ? '#ffffff' : '#9ca3af'
                                }}
                              >
                                {item.Message}
                              </Typography>
                            </Box>

                            {isNew && (
                              <Box sx={{
                                width: 8,
                                height: 8,
                                borderRadius: '50%',
                                backgroundColor: '#00d2ff',
                                boxShadow: '0 0 8px #00d2ff'
                              }} />
                            )}
                          </CardContent>
                        </Card>
                      </Grid>
                    );
                  })}
                </Grid>
              </Box>
            )}
          </Box>
        )}
      </Container>
    </Box>
  );
}
