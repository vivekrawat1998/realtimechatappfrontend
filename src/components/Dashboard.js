import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import io from 'socket.io-client';

const Dashboard = () => {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const socketRef = useRef();
  const navigate = useNavigate();
  
  useEffect(() => {
    console.log('Dashboard mounted');
    console.log('User from localStorage:', localStorage.getItem('user'));

    // Connect to socket server
    socketRef.current = io(`${process.env.REACT_APP_API_URL}`);
    
    const user = JSON.parse(localStorage.getItem('user'));
    if (user) {
      setCurrentUser(user);
    }
    if (!user) {
      console.log('No user found, redirecting to login');
      navigate('/login');
      return;
    }

    // Join chat
    socketRef.current.emit('join', { userId: user._id, username: user.username });

    // Listen for users list update
    socketRef.current.on('users', (updatedUsers) => {
      setUsers(updatedUsers.filter(u => u.userId !== user._id));
    });

    // Listen for online users updates
    socketRef.current.on('onlineUsers', (users) => {
      const currentUser = JSON.parse(localStorage.getItem('user'));
      console.log('Received online users:', users);
      // Filter out current user and ensure username exists
      const filteredUsers = users.filter(u => 
        u.userId !== currentUser._id && u.username
      );
      setOnlineUsers(filteredUsers);
    });

    // Listen for incoming messages
    socketRef.current.on('receiveMessage', (newMessage) => {
      setMessages(prev => [...prev, newMessage]);
    });

    // Listen for sent message confirmation
    socketRef.current.on('messageSent', (sentMessage) => {
      setMessages(prev => [...prev, sentMessage]);
    });

    // Listen for message status updates
    socketRef.current.on('message-status-update', ({ messageId, status, readAt }) => {
      setMessages(prev => prev.map(msg => 
        msg._id === messageId ? { ...msg, status, readAt } : msg
      ));
    });

    // Handle window resize
    const handleResize = () => {
      setIsSidebarOpen(window.innerWidth > 768);
    };
    
    window.addEventListener('resize', handleResize);
    handleResize();

    return () => {
      window.removeEventListener('resize', handleResize);
      socketRef.current.disconnect();
    };
  }, [navigate]);

  const sendMessage = (e) => {
    e.preventDefault();
    if (message.trim() && selectedUser) {
      const currentUser = JSON.parse(localStorage.getItem('user'));
      const messageData = {
        content: message,
        to: selectedUser.userId,
        from: currentUser._id,
      };
      socketRef.current.emit('sendMessage', messageData);
      setMessage('');
    }
  };

  // Update the setSelectedUser function
  const handleSelectUser = (user) => {
    setSelectedUser(user);
    const currentUser = JSON.parse(localStorage.getItem('user'));
    // Load chat history when selecting a user
    fetch(`/api/messages/history/${currentUser._id}/${user.userId}`)
      .then(res => res.json())
      .then(history => setMessages(history))
      .catch(err => console.error('Error loading chat history:', err));
  }

  const markMessageAsRead = (messageId) => {
    socketRef.current.emit('message-read', {
      messageId,
      readerId: currentUser._id
    });
  };

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Mobile Menu Button */}
      <button 
        className="md:hidden fixed top-4 left-4 z-20 p-2 bg-gray-800 text-white rounded"
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
      >
        {isSidebarOpen ? '✕' : '☰'}
      </button>

      {/* Responsive Sidebar */}
      <div className={`
        fixed md:static w-64 bg-gray-800 text-white h-full 
        transition-transform duration-300 ease-in-out z-10
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        md:translate-x-0
      `}>
        {/* Sidebar */}
        <div className="w-64 bg-gray-800 text-white flex flex-col">
          {/* Active User Profile */}
          <div className="p-4 border-b border-gray-700">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full bg-gray-600 flex items-center justify-center">
                {currentUser?.fullname?.charAt(0)}
              </div>
              <div>
                <div className="font-medium">{currentUser?.fullname}</div>
                <div className="text-sm text-gray-400">{currentUser?.email}</div>
              </div>
            </div>
          </div>

          {/* Online Users List */}
          <div className="p-4 flex-1 overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Online Users ({onlineUsers.length})</h2>
            <div className="space-y-2">
              {onlineUsers.map(user => (
                <div 
                  key={user.userId}
                  onClick={() => handleSelectUser(user)}
                  className={`flex items-center p-3 cursor-pointer rounded hover:bg-gray-700 transition-colors
                    ${selectedUser?.userId === user.userId ? 'bg-gray-700' : ''}`}
                >
                  {/* Online indicator */}
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                  <div className="flex flex-col">
                    <span className="text-white font-medium">{user.username}</span>
                    <span className="text-gray-400 text-sm">{user.email}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col w-full md:w-auto">
        {selectedUser ? (
          <div className="flex flex-col flex-1">
            <div className="bg-white p-4 shadow flex items-center">
              <button 
                className="md:hidden mr-4"
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              >
                ☰
              </button>
              <h3 className="text-lg font-semibold">
                Chatting with {selectedUser.username}
              </h3>
            </div>

            <div className="flex-1 p-4 overflow-y-auto">
              {messages
                .filter(msg => 
                  (msg.from === selectedUser.userId) || 
                  (msg.to === selectedUser.userId)
                )
                .map((msg, index) => (
                  <div 
                    key={index}
                    className={`max-w-[85%] md:max-w-[60%] p-3 rounded-lg mb-2 ${
                      msg.from === JSON.parse(localStorage.getItem('user')).username
                        ? 'ml-auto bg-blue-500 text-white'
                        : 'bg-gray-200 text-gray-800'
                    }`}
                    onLoad={() => {
                      if (msg.from !== currentUser._id && msg.status !== 'Read') {
                        markMessageAsRead(msg._id);
                      }
                    }}
                  >
                    <div className="flex flex-col">
                      <span>{msg.content}</span>
                      {msg.from === currentUser._id && (
                        <span className="text-xs text-black text-right mt-1">
                          {msg.status === 'Read' ? '✓✓' : '✓'}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
            </div>
            <form 
              onSubmit={sendMessage}
              className="bg-white p-4 border-t flex gap-2"
            >
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button 
                type="submit"
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                Send
              </button>
            </form>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500 text-lg p-4 text-center">
            Select a user to start chatting
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
