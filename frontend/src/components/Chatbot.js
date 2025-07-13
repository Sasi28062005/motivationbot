import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { 
  Container, TextField, Typography, Paper, Box, IconButton, 
  Avatar, CircularProgress, Zoom, Fade, Tooltip, Badge
} from "@mui/material";
import SendIcon from '@mui/icons-material/Send';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import PersonIcon from '@mui/icons-material/Person';
import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from '@mui/icons-material/MicOff';
import ImageIcon from '@mui/icons-material/Image'; // Add this import
import CancelIcon from '@mui/icons-material/Cancel'; // Add this import
import SettingsIcon from '@mui/icons-material/Settings'; // Import the settings icon
import { Button } from '@mui/material';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { v4 as uuidv4 } from 'uuid';
import { useNavigate } from 'react-router-dom'; // Add this import
import ArrowBackIcon from '@mui/icons-material/ArrowBack'; // Add this import

// Add this before your main Chatbot function

// Server configuration component
function ServerConfig({ apiUrl, onChangeUrl }) {
    const [showConfig, setShowConfig] = useState(false);
    const [url, setUrl] = useState(apiUrl);
    
    const handleSubmit = (e) => {
        e.preventDefault();
        if (url) {
            onChangeUrl(url);
            localStorage.setItem('chatbotApiUrl', url);
            setShowConfig(false);
        }
    };
    
    return (
        <>
            <Tooltip title="Server settings">
                <IconButton 
                    onClick={() => setShowConfig(!showConfig)} 
                    sx={{ position: 'absolute', top: 10, right: 10 }}
                >
                    <SettingsIcon />
                </IconButton>
            </Tooltip>
            
            {showConfig && (
                <Paper
                    elevation={3}
                    sx={{
                        position: 'absolute',
                        top: '60px',
                        right: '10px',
                        zIndex: 1000,
                        p: 2,
                        width: '300px'
                    }}
                >
                    <Typography variant="h6" sx={{ mb: 2 }}>Server Settings</Typography>
                    <form onSubmit={handleSubmit}>
                        <TextField
                            fullWidth
                            label="Server URL"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            placeholder="http://192.168.x.x:3001"
                            sx={{ mb: 2 }}
                        />
                        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                            <Button variant="outlined" onClick={() => setShowConfig(false)}>
                                Cancel
                            </Button>
                            <Button type="submit" variant="contained">
                                Save
                            </Button>
                        </Box>
                    </form>
                </Paper>
            )}
        </>
    );
}

function Chatbot() {
    const [message, setMessage] = useState("");
    const [chat, setChat] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [showScrollButton, setShowScrollButton] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [speechSupported, setSpeechSupported] = useState(false);
    const [selectedImage, setSelectedImage] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);
    const [userId, setUserId] = useState(""); // We'll use this for device ID
    const [apiBaseUrl, setApiBaseUrl] = useState(() => {
        // First try to get from localStorage
        const savedUrl = localStorage.getItem('chatbotApiUrl');
        if (savedUrl) return savedUrl;
        
        // Then try environment variable
        return process.env.REACT_APP_API_URL || 'http://localhost:3001';
    });
    
    const messagesEndRef = useRef(null);
    const chatContainerRef = useRef(null);
    const recognitionRef = useRef(null);
    const fileInputRef = useRef(null); // Add this ref
    const navigate = useNavigate(); // Add navigate functionality
    
    // Check if speech recognition is supported
    useEffect(() => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
            setSpeechSupported(true);
            recognitionRef.current = new SpeechRecognition();
            recognitionRef.current.continuous = false;
            recognitionRef.current.interimResults = false;
            recognitionRef.current.lang = 'en-US';
            
            recognitionRef.current.onresult = (event) => {
                const transcript = event.results[0][0].transcript;
                setMessage(prev => prev + transcript);
            };
            
            recognitionRef.current.onerror = (event) => {
                console.error('Speech recognition error', event);
                setIsListening(false);
            };
            
            recognitionRef.current.onend = () => {
                setIsListening(false);
            };
        }
    }, []);
    
    // Set up device ID and load previous chat history
    useEffect(() => {
        // Generate or retrieve device ID
        const generateDeviceId = () => {
            // Try to get existing ID
            let deviceId = localStorage.getItem('chatDeviceId');
            
            // If no ID exists, create one
            if (!deviceId) {
                // Create a unique ID using timestamp + random string
                deviceId = 'device_' + Date.now() + '_' + Math.random().toString(36).substring(2, 15);
                localStorage.setItem('chatDeviceId', deviceId);
            }
            
            return deviceId;
        };
        
        // Set the user ID and load chat history
        const deviceId = generateDeviceId();
        setUserId(deviceId);
        loadChatHistory(deviceId);
    }, []);
    
    // Use environment variables if available
    useEffect(() => {
        // For development flexibility, check if an environment variable exists
        const envApiUrl = process.env.REACT_APP_API_URL;
        if (envApiUrl) {
            setApiBaseUrl(envApiUrl);
        }
    }, []);
    
    // Add to the beginning of your component
    useEffect(() => {
        // Check if we have a selected chat
        const currentChatId = localStorage.getItem('currentChatId');
        if (!currentChatId) {
            // Redirect to chat selection if no chat is selected
            navigate('/');
        }
    }, [navigate]);
    
    // Function to load chat history from the server
    const loadChatHistory = async (deviceId) => {
        setIsLoading(true);
        try {
            // Get the current chat ID
            const chatId = localStorage.getItem('currentChatId');
            
            if (!chatId) {
                // No chat selected, nothing to load
                setChat([]);
                setIsLoading(false);
                return;
            }
            
            // Get chat history for specific chat ID
            const response = await axios.get(`${apiBaseUrl}/chat/${chatId}`);
            
            if (response.data.messages && response.data.messages.length > 0) {
                // Format messages for the UI
                const formattedMessages = response.data.messages.map(msg => {
                    if (msg.type === 'user') {
                        return {
                            user: msg.content,
                            timestamp: new Date(msg.timestamp),
                            image: msg.image
                        };
                    } else {
                        return {
                            bot: msg.content,
                            timestamp: new Date(msg.timestamp)
                        };
                    }
                });
                
                setChat(formattedMessages);
            } else {
                // New chat - no messages yet
                setChat([]);
            }
        } catch (error) {
            console.error("Error loading chat history:", error);
            setChat([]);
        } finally {
            setIsLoading(false);
        }
    };

    // Scroll to bottom whenever messages change
    useEffect(() => {
        scrollToBottom();
    }, [chat]);
    
    // Monitor scroll position
    useEffect(() => {
        const container = chatContainerRef.current;
        if (!container) return;
        
        const handleScroll = () => {
            const { scrollTop, scrollHeight, clientHeight } = container;
            setShowScrollButton(scrollHeight - scrollTop - clientHeight > 100);
        };
        
        container.addEventListener('scroll', handleScroll);
        return () => container.removeEventListener('scroll', handleScroll);
    }, []);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    const sendMessage = async (e) => {
        e?.preventDefault();
        if ((!message.trim() && !selectedImage) || isLoading) return;

        const userMessage = message;
        setMessage("");
        setIsLoading(true);
        
        // Get current chat ID
        const chatId = localStorage.getItem('currentChatId');
        if (!chatId) {
            console.error("No chat ID found");
            setIsLoading(false);
            return;
        }
        
        // Create message object for UI display
        const newMessage = { 
            user: userMessage, 
            timestamp: new Date(),
            image: imagePreview
        };
        
        // Add user message to chat immediately for responsive UI
        setChat(prev => [...prev, newMessage]);
        
        try {
            // Save user message to this specific chat
            await axios.post(`${apiBaseUrl}/chat/${chatId}/message`, {
                type: 'user',
                content: userMessage,
                image: imagePreview
            });
            
            // Get bot response
            const response = await axios.post(`${apiBaseUrl}/chatbot`, { 
                message: userMessage,
                userId: userId,
                chatId: chatId // Make sure this is included
            });
            
            // Add bot response to UI
            setChat(prev => [...prev, { bot: response.data.reply, timestamp: new Date() }]);
            
            // Save bot message to this specific chat
            await axios.post(`${apiBaseUrl}/chat/${chatId}/message`, {
                type: 'bot',
                content: response.data.reply
            });
        } catch (error) {
            console.error("Error:", error);
            setChat(prev => [
                ...prev, 
                { bot: "Sorry, I'm having trouble connecting right now. Please try again later.", timestamp: new Date() }
            ]);
        } finally {
            setIsLoading(false);
            // Clear image after sending
            if (selectedImage) {
                removeImage();
            }
        }
    };
    
    const clearConversation = async () => {
        const chatId = localStorage.getItem('currentChatId');
        if (!chatId) return;
        
        setChat([]);
        try {
            // Delete just this specific chat's messages
            await axios.delete(`${apiBaseUrl}/chat/${chatId}/messages`);
        } catch (error) {
            console.error("Error clearing chat history:", error);
        }
    };

    const formatTime = (date) => {
        return new Intl.DateTimeFormat('en-US', {
            hour: '2-digit',
            minute: '2-digit'
        }).format(date);
    };

    const toggleListening = () => {
        if (isListening) {
            recognitionRef.current.stop();
            setIsListening(false);
        } else {
            try {
                recognitionRef.current.start();
                setIsListening(true);
            } catch (err) {
                console.error('Speech recognition error:', err);
            }
        }
    };

    const handleImageClick = () => {
        fileInputRef.current.click();
    };

    const handleImageChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setSelectedImage(file);
            setImagePreview(URL.createObjectURL(file));
        }
    };

    const removeImage = () => {
        setSelectedImage(null);
        setImagePreview(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = null;
        }
    };

    const goBackToChats = () => {
        navigate('/');
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
                <ServerConfig 
                    apiUrl={apiBaseUrl} 
                    onChangeUrl={setApiBaseUrl} 
                />
                
                <Box sx={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between',
                    mb: 3,
                    pb: 2,
                    borderBottom: '1px solid rgba(25, 118, 210, 0.2)'
                }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <IconButton 
                            onClick={goBackToChats} 
                            sx={{ color: '#1976d2' }}
                        >
                            <ArrowBackIcon />
                        </IconButton>
                        
                        <Avatar sx={{ bgcolor: '#1976d2', width: 48, height: 48 }}>
                            <SmartToyIcon sx={{ fontSize: 28 }} />
                        </Avatar>
                        <Box>
                            <Typography variant="h5" sx={{ fontWeight: 700, color: '#1976d2' }}>
                             Motivational chatbot
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                Ask me anything about your emotions
                            </Typography>
                        </Box>
                    </Box>
                    
                    <Tooltip title="Clear conversation">
                        <IconButton 
                            onClick={clearConversation}
                            sx={{ 
                                color: 'rgba(0,0,0,0.6)',
                                '&:hover': { bgcolor: 'rgba(25,118,210,0.08)' }
                            }}
                        >
                            <DeleteSweepIcon />
                        </IconButton>
                    </Tooltip>
                </Box>

                <Box 
                    ref={chatContainerRef}
                    sx={{ 
                        height: 450, 
                        overflowY: "auto", 
                        padding: 2, 
                        backgroundColor: "rgba(255,255,255,0.7)",
                        borderRadius: 3,
                        marginBottom: 2,
                        boxShadow: 'inset 0 0 10px rgba(0,0,0,0.05)',
                        position: 'relative',
                        scrollBehavior: 'smooth',
                        '&::-webkit-scrollbar': {
                            width: '8px',
                        },
                        '&::-webkit-scrollbar-track': {
                            background: 'rgba(0,0,0,0.05)',
                            borderRadius: '10px',
                        },
                        '&::-webkit-scrollbar-thumb': {
                            background: 'rgba(25,118,210,0.3)',
                            borderRadius: '10px',
                            '&:hover': {
                                background: 'rgba(25,118,210,0.5)',
                            }
                        }
                    }}
                >
                    {chat.length === 0 && (
                        <Box sx={{ 
                            height: '100%', 
                            display: 'flex', 
                            flexDirection: 'column',
                            justifyContent: 'center', 
                            alignItems: 'center',
                            opacity: 0.7
                        }}>
                            <SmartToyIcon sx={{ fontSize: 60, color: '#1976d2', mb: 2, opacity: 0.6 }} />
                            <Typography variant="body1" color="text.secondary" align="center">
                                Hi there! How can I help you today?
                            </Typography>
                            <Typography variant="body2" color="text.secondary" align="center" sx={{ mt: 1, maxWidth: '70%' }}>
                                Ask me anything about your emotions
                            </Typography>
                        </Box>
                    )}

                    {chat.map((msg, index) => (
                        <Fade in={true} key={index} timeout={500}>
                            <Box sx={{ marginBottom: 2 }}>
                                {msg.user && (
                                    <Box sx={{ 
                                        display: 'flex', 
                                        justifyContent: 'flex-end',
                                        alignItems: 'flex-end',
                                        gap: 1
                                    }}>
                                        <Box sx={{ 
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'flex-end'
                                        }}>
                                            <Typography 
                                                variant="caption" 
                                                sx={{ mb: 0.5, mr: 1, color: 'text.secondary' }}
                                            >
                                                {formatTime(msg.timestamp)}
                                            </Typography>
                                            
                                            <Box
                                                sx={{ 
                                                    backgroundColor: '#1976d2',
                                                    color: 'white',
                                                    padding: msg.image ? '8px' : '10px 16px',
                                                    borderRadius: '18px 18px 0 18px',
                                                    maxWidth: '500px',
                                                    boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                                                    overflow: 'hidden',
                                                    display: 'flex',
                                                    flexDirection: 'column'
                                                }}
                                            >
                                                {msg.image && (
                                                    <Box sx={{ mb: msg.user ? 1 : 0, borderRadius: '12px', overflow: 'hidden' }}>
                                                        <img 
                                                            src={msg.image} 
                                                            alt="User uploaded" 
                                                            style={{ 
                                                                maxWidth: '100%',
                                                                maxHeight: '300px',
                                                                objectFit: 'contain',
                                                                borderRadius: '12px'
                                                            }} 
                                                        />
                                                    </Box>
                                                )}
                                                {msg.user && (
                                                    <Typography sx={{ wordBreak: 'break-word' }}>
                                                        {msg.user}
                                                    </Typography>
                                                )}
                                            </Box>
                                        </Box>
                                        
                                        <Avatar sx={{ 
                                            bgcolor: 'rgba(25,118,210,0.2)', 
                                            width: 32, 
                                            height: 32,
                                            color: '#1976d2'
                                        }}>
                                            <PersonIcon fontSize="small" />
                                        </Avatar>
                                    </Box>
                                )}
                                
                                {msg.bot && (
                                    <Box sx={{ 
                                        display: 'flex', 
                                        justifyContent: 'flex-start',
                                        alignItems: 'flex-start',
                                        gap: 1,
                                        mt: 1.5
                                    }}>
                                        <Avatar sx={{ 
                                            bgcolor: '#e3f2fd', 
                                            color: '#1976d2',
                                            width: 32, 
                                            height: 32
                                        }}>
                                            <SmartToyIcon fontSize="small" />
                                        </Avatar>
                                        
                                        <Box sx={{ 
                                            display: 'flex',
                                            flexDirection: 'column'
                                        }}>
                                            <Typography 
                                                variant="caption" 
                                                sx={{ mb: 0.5, ml: 1, color: 'text.secondary' }}
                                            >
                                                {formatTime(msg.timestamp)}
                                            </Typography>
                                            
                                            <Paper 
                                                sx={{ 
                                                    backgroundColor: '#e3f2fd',
                                                    padding: '12px 16px',
                                                    borderRadius: '18px 18px 18px 0',
                                                    maxWidth: '500px',
                                                    boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                                                }}
                                            >
                                                <ReactMarkdown 
                                                    remarkPlugins={[remarkGfm]}
                                                    components={{
                                                        p: ({node, ...props}) => (
                                                            <Typography 
                                                                sx={{ color: '#37474f', mb: 1 }} 
                                                                {...props}
                                                            />
                                                        ),
                                                        h1: ({node, ...props}) => (
                                                            <Typography 
                                                                variant="h6" 
                                                                sx={{ color: '#1976d2', fontWeight: 600, mt: 1, mb: 1 }}
                                                                {...props}
                                                            />
                                                        ),
                                                        h2: ({node, ...props}) => (
                                                            <Typography 
                                                                variant="subtitle1"
                                                                sx={{ color: '#1976d2', fontWeight: 600, mt: 1, mb: 1 }}
                                                                {...props}
                                                            />
                                                        ),
                                                        ul: ({node, ...props}) => (
                                                            <Box component="ul" sx={{ pl: 2, mb: 1 }} {...props} />
                                                        ),
                                                        ol: ({node, ...props}) => (
                                                            <Box component="ol" sx={{ pl: 2, mb: 1 }} {...props} />
                                                        ),
                                                        li: ({node, ...props}) => (
                                                            <Box 
                                                                component="li" 
                                                                sx={{ color: '#37474f', mb: 0.5 }}
                                                                {...props}
                                                            />
                                                        ),
                                                        a: ({node, ...props}) => (
                                                            <Box
                                                                component="a"
                                                                sx={{ 
                                                                    color: '#0277bd', 
                                                                    textDecoration: 'none',
                                                                    '&:hover': {
                                                                        textDecoration: 'underline'
                                                                    }
                                                                }}
                                                                {...props}
                                                            />
                                                        ),
                                                        blockquote: ({node, ...props}) => (
                                                            <Box
                                                                sx={{
                                                                    borderLeft: '4px solid #90caf9',
                                                                    pl: 2,
                                                                    py: 0.5,
                                                                    bgcolor: 'rgba(25,118,210,0.08)',
                                                                    borderRadius: '0 4px 4px 0',
                                                                    my: 1
                                                                }}
                                                                {...props}
                                                            />
                                                        ),
                                                        code: ({node, inline, className, children, ...props}) => {
                                                            const match = /language-(\w+)/.exec(className || '');
                                                            return !inline && match ? (
                                                                <Box sx={{ my: 2 }}>
                                                                    <SyntaxHighlighter
                                                                        style={atomDark}
                                                                        language={match[1]}
                                                                        PreTag="div"
                                                                        sx={{
                                                                            borderRadius: '8px',
                                                                            maxWidth: '100%',
                                                                            overflowX: 'auto'
                                                                        }}
                                                                        {...props}
                                                                    >
                                                                        {String(children).replace(/\n$/, '')}
                                                                    </SyntaxHighlighter>
                                                                </Box>
                                                            ) : (
                                                                <Typography 
                                                                    component="code"
                                                                    sx={{
                                                                        backgroundColor: 'rgba(0,0,0,0.1)',
                                                                        padding: '2px 4px',
                                                                        borderRadius: 1,
                                                                        fontFamily: 'monospace',
                                                                        fontSize: '0.875rem'
                                                                    }}
                                                                    {...props}
                                                                />
                                                            );
                                                        },
                                                        table: ({node, ...props}) => (
                                                            <Box 
                                                                sx={{ 
                                                                    overflowX: 'auto', 
                                                                    my: 2,
                                                                    '& table': {
                                                                        borderCollapse: 'collapse',
                                                                        width: '100%',
                                                                    },
                                                                    '& th, & td': {
                                                                        border: '1px solid #ccc',
                                                                        padding: '8px 12px',
                                                                        textAlign: 'left'
                                                                    },
                                                                    '& th': {
                                                                        backgroundColor: 'rgba(25,118,210,0.1)',
                                                                    }
                                                                }} 
                                                                {...props} 
                                                            />
                                                        )
                                                    }}
                                                >
                                                    {msg.bot}
                                                </ReactMarkdown>
                                            </Paper>
                                        </Box>
                                    </Box>
                                )}
                            </Box>
                        </Fade>
                    ))}
                    
                    {isLoading && (
                        <Fade in={true}>
                            <Box sx={{ 
                                display: 'flex', 
                                justifyContent: 'flex-start',
                                mt: 1,
                                ml: 6
                            }}>
                                <Paper 
                                    sx={{ 
                                        backgroundColor: '#e3f2fd',
                                        padding: '10px 16px',
                                        borderRadius: '18px 18px 18px 0',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 1
                                    }}
                                >
                                    <Box sx={{ 
                                        display: 'flex', 
                                        alignItems: 'center',
                                        gap: 0.7
                                    }}>
                                        <Box 
                                            className="typing-dot"
                                            sx={{ 
                                                width: 8,
                                                height: 8,
                                                borderRadius: '50%',
                                                backgroundColor: '#1976d2',
                                                animation: 'typing-dot 1.4s infinite ease-in-out both',
                                                animationDelay: '0s',
                                                '@keyframes typing-dot': {
                                                    '0%, 80%, 100%': { transform: 'scale(0)' },
                                                    '40%': { transform: 'scale(1)' }
                                                }
                                            }}
                                        />
                                        <Box 
                                            className="typing-dot"
                                            sx={{ 
                                                width: 8,
                                                height: 8,
                                                borderRadius: '50%',
                                                backgroundColor: '#1976d2',
                                                animation: 'typing-dot 1.4s infinite ease-in-out both',
                                                animationDelay: '0.2s',
                                                '@keyframes typing-dot': {
                                                    '0%, 80%, 100%': { transform: 'scale(0)' },
                                                    '40%': { transform: 'scale(1)' }
                                                }
                                            }}
                                        />
                                        <Box 
                                            className="typing-dot"
                                            sx={{ 
                                                width: 8,
                                                height: 8,
                                                borderRadius: '50%',
                                                backgroundColor: '#1976d2',
                                                animation: 'typing-dot 1.4s infinite ease-in-out both',
                                                animationDelay: '0.4s',
                                                '@keyframes typing-dot': {
                                                    '0%, 80%, 100%': { transform: 'scale(0)' },
                                                    '40%': { transform: 'scale(1)' }
                                                }
                                            }}
                                        />
                                    </Box>
                                </Paper>
                            </Box>
                        </Fade>
                    )}
                    
                    <div ref={messagesEndRef} />
                </Box>
                
                {showScrollButton && (
                    <Zoom in={showScrollButton}>
                        <IconButton 
                            onClick={scrollToBottom}
                            sx={{
                                position: 'absolute',
                                bottom: 100,
                                right: 30,
                                backgroundColor: 'rgba(25,118,210,0.8)',
                                color: 'white',
                                '&:hover': { backgroundColor: '#1976d2' }
                            }}
                        >
                            <KeyboardArrowDownIcon />
                        </IconButton>
                    </Zoom>
                )}

                <form onSubmit={sendMessage} style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', position: 'relative' }}>
                    {imagePreview && (
                        <Box sx={{ 
                            position: 'absolute', 
                            bottom: '100%', 
                            left: 0, 
                            mb: 1,
                            p: 1,
                            bgcolor: 'white',
                            borderRadius: 2,
                            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                            display: 'flex',
                            flexDirection: 'column'
                        }}>
                            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1 }}>
                                <IconButton 
                                    size="small" 
                                    onClick={removeImage} 
                                    sx={{ backgroundColor: 'rgba(0,0,0,0.1)' }}
                                >
                                    <CancelIcon fontSize="small" />
                                </IconButton>
                            </Box>
                            <img 
                                src={imagePreview} 
                                alt="Preview" 
                                style={{ 
                                    maxWidth: '200px', 
                                    maxHeight: '150px', 
                                    objectFit: 'contain',
                                    borderRadius: '8px'
                                }}
                            />
                        </Box>
                    )}
                
                    <TextField
                        fullWidth
                        variant="outlined"
                        placeholder="Type your message..."
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        disabled={isLoading}
                        sx={{ 
                            '& .MuiOutlinedInput-root': {
                                borderRadius: '30px',
                                backgroundColor: 'white',
                                boxShadow: '0 2px 5px rgba(0,0,0,0.08)',
                                transition: 'box-shadow 0.3s ease',
                                '&:hover, &.Mui-focused': {
                                    boxShadow: '0 3px 10px rgba(0,0,0,0.12)',
                                }
                            }
                        }}
                    />
                    
                    <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageChange}
                        style={{ display: 'none' }}
                        ref={fileInputRef}
                    />
                    
                    <Tooltip title="Add image">
                        <IconButton 
                            onClick={handleImageClick}
                            disabled={isLoading}
                            sx={{
                                backgroundColor: selectedImage ? '#4caf50' : '#9c27b0',
                                color: 'white',
                                padding: '12px',
                                boxShadow: '0 3px 5px rgba(0,0,0,0.2)',
                                '&:hover': {
                                    backgroundColor: selectedImage ? '#43a047' : '#7b1fa2',
                                    transform: 'translateY(-2px)',
                                    boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
                                },
                                transition: 'transform 0.2s, box-shadow 0.2s',
                            }}
                        >
                            <Badge
                                color="error"
                                variant="dot"
                                invisible={!selectedImage}
                            >
                                <ImageIcon />
                            </Badge>
                        </IconButton>
                    </Tooltip>

                    {speechSupported && (
                        <Tooltip title={isListening ? "Stop recording" : "Voice input"}>
                            <IconButton 
                                onClick={toggleListening}
                                disabled={isLoading}
                                sx={{
                                    backgroundColor: isListening ? '#d32f2f' : '#1976d2',
                                    color: 'white',
                                    padding: '12px',
                                    boxShadow: '0 3px 5px rgba(0,0,0,0.2)',
                                    '&:hover': {
                                        backgroundColor: isListening ? '#c62828' : '#1565c0',
                                        transform: 'translateY(-2px)',
                                        boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
                                    },
                                    '&:active': {
                                        transform: 'translateY(0)',
                                        boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                                    },
                                    transition: 'transform 0.2s, box-shadow 0.2s',
                                }}
                            >
                                {isListening ? <MicOffIcon /> : <MicIcon />}
                            </IconButton>
                        </Tooltip>
                    )}
                    
                    <IconButton 
                        type="submit"
                        disabled={isLoading || (!message.trim() && !selectedImage)}
                        sx={{
                            backgroundColor: '#1976d2',
                            color: 'white',
                            padding: '12px',
                            boxShadow: '0 3px 5px rgba(0,0,0,0.2)',
                            '&:hover': {
                                backgroundColor: '#1565c0',
                                transform: 'translateY(-2px)',
                                boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
                            },
                            '&:active': {
                                transform: 'translateY(0)',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                            },
                            transition: 'transform 0.2s, box-shadow 0.2s',
                            '&.Mui-disabled': {
                                backgroundColor: 'rgba(0,0,0,0.12)',
                                color: 'rgba(0,0,0,0.26)',
                            }
                        }}
                    >
                        {isLoading ? <CircularProgress size={24} color="inherit" /> : <SendIcon />}
                    </IconButton>
                </form>
            </Paper>
        </Container>
    );
}

export default Chatbot;
