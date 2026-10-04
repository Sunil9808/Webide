const io = require('socket.io-client');

const socket = io('http://localhost:5000', {
  path: '/socket.io',
  transports: ['websocket']
});

socket.on('connect', () => {
  console.log('Connected to socket!');
  
  const sessionId = 'test-session-' + Date.now();
  
  socket.emit('terminal:create', {
    sessionId,
    shell: 'powershell',
    cwd: process.cwd()
  });

  socket.on('terminal:created', (data) => {
    console.log('Terminal created:', data);
  });

  socket.on('terminal:data', (data) => {
    console.log('Terminal data received:', JSON.stringify(data.data));
  });

  socket.on('terminal:error', (err) => {
    console.log('Terminal error:', err);
  });

  setTimeout(() => {
    socket.disconnect();
    process.exit(0);
  }, 3000);
});

socket.on('connect_error', (err) => {
  console.log('Connection error:', err);
  process.exit(1);
});
