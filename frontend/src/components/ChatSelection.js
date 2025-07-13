import React, { useState, useEffect } from 'react';
import { 
  Container, Typography, Box, Paper, Button, List, 
  ListItem, ListItemText, ListItemAvatar, Avatar, 
  ListItemSecondary, IconButton, Divider, TextField,
  CircularProgress
} from '@mui/material';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import AddIcon from '@mui/icons-material/Add';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import DeleteIcon from '@mui/icons-material/Delete';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { v4 as uuidv4 } from 'uuid';

function ChatSelection() {
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [apiBaseUrl, setApiBaseUrl] = useState(() => {
    const savedUrl = localStorage.getItem('chatbotApiUrl');
    if (savedUrl) return savedUrl;
    return process.env.REACT_APP_API_URL || 'http://localhost:3001';
  });
  
  const navigate = useNavigate();
  
  useEffect(() => {
    loadChats();
  }, []);
  
  const loadChats = async () => {
    setLoading(true);
    try {
      // Get device ID for current user
      const deviceId = localStorage.getItem('chatDeviceId');
      if (!deviceId) {
        setChats([]);
        setLoading(false);
        return;
      }
      
      // Get all chats for this user
      const response = await axios.get(`${apiBaseUrl}/user-chats/${deviceId}`);
      if (response.data && response.data.chats) {
        setChats(response.data.chats);
      }
    } catch (error) {
      console.error("Error fetching chats:", error);
    } finally {
      setLoading(false);
    }
  };
  
  const createNewChat = async () => {
    try {
      setLoading(true); // Add loading state
      
      // Get or create device ID
      let deviceId = localStorage.getItem('chatDeviceId');
      if (!deviceId) {
        deviceId = 'device_' + Date.now() + '_' + Math.random().toString(36).substring(2, 15);
        localStorage.setItem('chatDeviceId', deviceId);
      }
      
      console.log(`Creating new chat for user: ${deviceId}`);
      
      // Create a new chat on the server
      const response = await axios.post(`${apiBaseUrl}/chat/new`, { userId: deviceId });
      
      console.log("Server response:", response.data);
      
      if (response.data && response.data.chatId) {
        // Store the new chat ID
        localStorage.setItem('currentChatId', response.data.chatId);
        
        // Navigate to chat page
        navigate('/chat');
      } else {
        console.error("Failed to create new chat: No chat ID returned", response.data);
        alert("Could not create a new chat. Please try again.");
      }
    } catch (error) {
      console.error("Error creating new chat:", error);
      // Display more helpful error message
      if (error.response) {
        // Server responded with an error
        alert(`Server error: ${error.response.data?.error || error.response.status}`);
      } else if (error.request) {
        // Request was made but no response
        alert("Server not responding. Please check your connection.");
      } else {
        alert("Could not create a new chat. Please try again.");
      }
    } finally {
      setLoading(false); // End loading state
    }
  };
  
  const openChat = (chatId) => {
    localStorage.setItem('currentChatId', chatId);
    navigate('/chat');
  };
  
  const deleteChat = async (chatId, event) => {
    event.stopPropagation();
    try {
      await axios.delete(`${apiBaseUrl}/chat/${chatId}`);
      // Refresh the list
      loadChats();
    } catch (error) {
      console.error("Error deleting chat:", error);
    }
  };
  
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };
  
  return (
    <Container maxWidth="md">
      <Paper 
        elevation={8} 
        sx={{ 
          padding: { xs: 2, sm: 3 }, 
          marginY: 5, 
          borderRadius: 4,
          background: 'linear-gradient(135deg, #f5f7fa 0%, #e6eef8 100%)',
          boxShadow: '0 12px 24px rgba(0,0,0,0.1)',
          overflow: 'hidden',
          position: 'relative'
        }}
      >
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 3
        }}>
          <Typography variant="h4" sx={{ fontWeight: 600, color: '#1976d2' }}>
            Your Conversations
          </Typography>
          
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={createNewChat}
            sx={{ 
              borderRadius: 8,
              px: 3,
              boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
            }}
          >
            New Chat
          </Button>
        </Box>
        
        <Divider sx={{ mb: 3 }} />
        
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress />
          </Box>
        ) : chats.length === 0 ? (
          <Box sx={{ 
            py: 8, 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            bgcolor: 'rgba(255,255,255,0.5)',
            borderRadius: 4
          }}>
            <SmartToyIcon sx={{ fontSize: 60, color: '#1976d2', opacity: 0.6, mb: 2 }} />
            <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>
              No conversations yet
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3, textAlign: 'center' }}>
              Start a new chat to talk with the motivational chatbot
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={createNewChat}
              sx={{ borderRadius: 8, px: 3 }}
            >
              Start First Conversation
            </Button>
          </Box>
        ) : (
          <List sx={{ 
            bgcolor: 'rgba(255,255,255,0.5)', 
            borderRadius: 4,
            overflow: 'hidden'
          }}>
            {chats.map((chat) => (
              <React.Fragment key={chat.chatId}>
                <ListItem
                  alignItems="flex-start"
                  onClick={() => openChat(chat.chatId)}
                  sx={{ 
                    cursor: 'pointer',
                    '&:hover': { 
                      bgcolor: 'rgba(25,118,210,0.08)' 
                    },
                    py: 2
                  }}
                  secondaryAction={
                    <Box>
                      <IconButton 
                        edge="end" 
                        onClick={(e) => deleteChat(chat.chatId, e)}
                        sx={{ mr: 1 }}
                      >
                        <DeleteIcon />
                      </IconButton>
                      <IconButton edge="end" color="primary">
                        <ArrowForwardIcon />
                      </IconButton>
                    </Box>
                  }
                >
                  <ListItemAvatar>
                    <Avatar sx={{ bgcolor: '#1976d2' }}>
                      <SmartToyIcon />
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>
                        {chat.title || "Conversation"}
                      </Typography>
                    }
                    secondary={
                      <React.Fragment>
                        <Typography variant="body2" color="text.secondary" sx={{ 
                          display: 'inline',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          maxWidth: '70%'
                        }}>
                          {chat.lastMessage || "No messages yet"}
                        </Typography>
                        <Typography variant="caption" sx={{ display: 'block', mt: 0.5, color: 'text.secondary' }}>
                          {formatDate(chat.updatedAt)}
                        </Typography>
                      </React.Fragment>
                    }
                  />
                </ListItem>
                <Divider variant="inset" component="li" />
              </React.Fragment>
            ))}
          </List>
        )}
      </Paper>
    </Container>
  );
}

export default ChatSelection;