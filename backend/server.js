const express = require("express");
const cors = require("cors");
const OpenAI = require("openai");
const multer = require("multer"); // For handling file uploads
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose"); // For MongoDB
require("dotenv").config(); // Load environment variables from .env file

const app = express();
app.use(cors({
    origin: '*', // Allow all origins during development
    methods: ['GET', 'POST', 'DELETE', 'PUT', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
const port = process.env.PORT || 3001;

app.use(express.json());

// MongoDB Connection (using environment variable)
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/chatbot', { // Use MONGODB_URI from .env or local fallback
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => console.log('MongoDB connected'))
.catch(err => console.error('MongoDB connection error:', err));

// Define schemas and models
const messageSchema = new mongoose.Schema({
    userId: String,
    messages: [{
        type: { type: String, enum: ['user', 'bot'] },
        content: String,
        image: String,
        timestamp: { type: Date, default: Date.now }
    }]
});

const Message = mongoose.model('Message', messageSchema);

// Multer setup for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, "uploads");
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir);
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB file size limit
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed!'), false);
        }
    }
});

const openai = new OpenAI({
    baseURL: "https://api-inference.huggingface.co/models/HuggingFaceH4/zephyr-7b-beta",
    apiKey: process.env.HUGGINGFACE_API_KEY,
});

// Get chat history for a user
app.get("/chat-history/:userId", async (req, res) => {
    try {
        const userId = req.params.userId;
        const userChat = await Message.findOne({ userId });

        if (!userChat) {
            return res.json({ messages: [] });
        }

        res.json({ messages: userChat.messages });
    } catch (error) {
        console.error("Error fetching chat history:", error);
        res.status(500).json({ error: "Failed to fetch chat history" });
    }
});

// Add this endpoint to delete chat history for a user
app.delete("/chat-history/:userId", async (req, res) => {
    try {
        const userId = req.params.userId;
        await Message.findOneAndDelete({ userId });
        res.json({ success: true, message: "Chat history cleared" });
    } catch (error) {
        console.error("Error clearing chat history:", error);
        res.status(500).json({ error: "Failed to clear chat history" });
    }
});

// Add these endpoints to support multiple chats

// Get all chats for a user
app.get("/user-chats/:userId", async (req, res) => {
  try {
    const userId = req.params.userId;
    const userChats = await Message.find({ userId });
    
    // Format the chats for the frontend
    const formattedChats = userChats.map(chat => {
      // Find the last message
      const messages = chat.messages || [];
      const lastMessage = messages.length > 0 ? 
        messages[messages.length - 1] : null;
      
      // Create a title from the first user message
      const firstUserMessage = messages.find(msg => msg.type === 'user');
      
      return {
        chatId: chat._id,
        title: firstUserMessage ? 
          (firstUserMessage.content.length > 30 ? 
            firstUserMessage.content.substring(0, 30) + '...' : 
            firstUserMessage.content) : 
          "New Conversation",
        lastMessage: lastMessage ? 
          (lastMessage.type === 'user' ? 'You: ' : 'Bot: ') + 
          (lastMessage.content.length > 50 ? 
            lastMessage.content.substring(0, 50) + '...' : 
            lastMessage.content) : 
          null,
        updatedAt: chat.updatedAt || new Date(),
        messageCount: messages.length
      };
    });
    
    res.json({ chats: formattedChats });
  } catch (error) {
    console.error("Error fetching user chats:", error);
    res.status(500).json({ error: "Failed to fetch chats" });
  }
});

// Delete a specific chat
app.delete("/chat/:chatId", async (req, res) => {
  try {
    const chatId = req.params.chatId;
    await Message.findByIdAndDelete(chatId);
    res.json({ success: true, message: "Chat deleted successfully" });
  } catch (error) {
    console.error("Error deleting chat:", error);
    res.status(500).json({ error: "Failed to delete chat" });
  }
});

// Add these routes to handle individual chats

// Create a new chat
app.post("/chat/new", async (req, res) => {
  try {
    const { userId } = req.body;
    
    // Validate user ID
    if (!userId || userId.trim() === '') {
      console.log("Missing userId in request", req.body);
      return res.status(400).json({ error: "User ID is required" });
    }
    
    console.log(`Creating new chat for user: ${userId}`);
    
    // Create a new chat document
    const newChat = new Message({
      userId,
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    const savedChat = await newChat.save();
    console.log(`New chat created with ID: ${savedChat._id}`);
    
    res.json({ 
      success: true,
      chatId: savedChat._id.toString(),
      message: "New chat created successfully" 
    });
  } catch (error) {
    console.error("Error creating new chat:", error);
    res.status(500).json({ error: "Failed to create new chat", details: error.message });
  }
});

// Get a specific chat by ID
app.get("/chat/:chatId", async (req, res) => {
  try {
    const chatId = req.params.chatId;
    const chat = await Message.findById(chatId);
    
    if (!chat) {
      return res.status(404).json({ error: "Chat not found" });
    }
    
    res.json({ messages: chat.messages });
  } catch (error) {
    console.error("Error fetching chat:", error);
    res.status(500).json({ error: "Failed to fetch chat" });
  }
});

// Save message to specific chat
app.post("/chat/:chatId/message", async (req, res) => {
  try {
    const chatId = req.params.chatId;
    const { type, content, image } = req.body;
    
    const chat = await Message.findById(chatId);
    if (!chat) {
      return res.status(404).json({ error: "Chat not found" });
    }
    
    // Add new message
    chat.messages.push({
      type,
      content,
      image,
      timestamp: new Date()
    });
    
    await chat.save();
    res.json({ success: true });
  } catch (error) {
    console.error("Error saving message:", error);
    res.status(500).json({ error: "Failed to save message" });
  }
});

// Add this endpoint to clear messages from a specific chat

app.delete("/chat/:chatId/messages", async (req, res) => {
  try {
    const chatId = req.params.chatId;
    
    const chat = await Message.findById(chatId);
    if (!chat) {
      return res.status(404).json({ error: "Chat not found" });
    }
    
    // Clear messages but keep the chat document
    chat.messages = [];
    await chat.save();
    
    res.json({ success: true, message: "Chat messages cleared" });
  } catch (error) {
    console.error("Error clearing chat messages:", error);
    res.status(500).json({ error: "Failed to clear chat messages" });
  }
});

// Replace your existing /chatbot route with this one:

// Text-only chatbot route with conversation history
app.post("/chatbot", async (req, res) => {
    const userMessage = req.body.message;
    const userId = req.body.userId;
    const chatId = req.body.chatId;

    try {
        // Get conversation history
        let conversationHistory = [];
        
        if (chatId) {
            // Try to find existing chat by chatId
            const chat = await Message.findById(chatId);
            if (chat) {
                // Format previous messages for the AI
                conversationHistory = chat.messages.map(msg => ({
                    role: msg.type === 'user' ? 'user' : 'assistant',
                    content: msg.content
                }));
            }
        } else if (userId) {
            // Legacy support - try to find by userId
            const userChat = await Message.findOne({ userId });
            if (userChat) {
                conversationHistory = userChat.messages.map(msg => ({
                    role: msg.type === 'user' ? 'user' : 'assistant',
                    content: msg.content
                }));
            }
        }

        // Create message array with history
        const messages = [
            { 
                role: "system", 
                content: "You are a motivational speaker and should provide a motivational response to the user. If the user emotions are in unstable state, you should provide a motivational response and suggest a best song to motivate them. For greetings like hi and hello, respond with friendly greetings."
            }
        ];
        
        // Add conversation history (limit to last 10 messages to avoid context limit)
        if (conversationHistory.length > 0) {
            messages.push(...conversationHistory.slice(-10));
        }
        
        // Add the current message
        messages.push({ role: "user", content: userMessage });

        // Call the API with conversation history
        const response = await openai.chat.completions.create({
            model: "learnlm-1.5-pro-experimental",
            messages: messages,
        });

        const botReply = response.choices[0].message.content;

        // Save messages to database
        if (chatId) {
            // Save to specific chat
            await saveMessageToSpecificChat(chatId, 'user', userMessage);
            await saveMessageToSpecificChat(chatId, 'bot', botReply);
        } else if (userId) {
            // Legacy support
            await saveMessageToDb(userId, 'user', userMessage);
            await saveMessageToDb(userId, 'bot', botReply);
        }

        res.json({ reply: botReply });
    } catch (error) {
        console.error("Error:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// Replace your existing /chatbot-with-image route with this one:

// Chatbot route with image upload and conversation history
app.post("/chatbot-with-image", upload.single("image"), async (req, res) => {
    try {
        const userMessage = req.body.message || "";
        const userId = req.body.userId;
        const chatId = req.body.chatId;
        let imageUrl = null;

        if (req.file) {
            imageUrl = `uploads/${req.file.filename}`;
        }

        // Get conversation history
        let conversationHistory = [];
        
        if (chatId) {
            const chat = await Message.findById(chatId);
            if (chat) {
                conversationHistory = chat.messages.map(msg => ({
                    role: msg.type === 'user' ? 'user' : 'assistant',
                    content: msg.content
                }));
            }
        } else if (userId) {
            const userChat = await Message.findOne({ userId });
            if (userChat) {
                conversationHistory = userChat.messages.map(msg => ({
                    role: msg.type === 'user' ? 'user' : 'assistant',
                    content: msg.content
                }));
            }
        }

        let promptText = userMessage;
        if (req.file) {
            promptText = `[User uploaded an image] ${userMessage}`;
        }

        // Create message array with history
        const messages = [
            {
                role: "system",
                content: "You are a motivational speaker and should provide a motivational response to the user. If the user emotions are in unstable state, you should provide a motivational response and suggest a best song to motivate them. For greetings like hi and hello, respond with friendly greetings."
            }
        ];
        
        // Add conversation history (limit to last 10 messages to avoid context limit)
        if (conversationHistory.length > 0) {
            messages.push(...conversationHistory.slice(-10));
        }
        
        // Add the current message
        messages.push({ role: "user", content: promptText });

        const response = await openai.chat.completions.create({
            model: "gemini-2-0-flash",
            messages: messages,
        });

        const botReply = response.choices[0].message.content;

        // Save messages to database
        if (chatId) {
            await saveMessageToSpecificChat(chatId, 'user', userMessage, imageUrl);
            await saveMessageToSpecificChat(chatId, 'bot', botReply);
        } else if (userId) {
            await saveMessageToDb(userId, 'user', userMessage, imageUrl);
            await saveMessageToDb(userId, 'bot', botReply);
        }

        if (req.file) {
            fs.unlink(req.file.path, (err) => {
                if (err) console.error("Error deleting file:", err);
            });
        }

        res.json({ reply: botReply });
    } catch (error) {
        console.error("Error:", error);
        if (req.file) {
            fs.unlink(req.file.path, (err) => {
                if (err) console.error("Error deleting file:", err);
            });
        }
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// Updated saveMessageToDb function
async function saveMessageToDb(userId, type, content, image = null) {
    // Skip if no userId provided
    if (!userId) {
        console.log('No userId provided - skipping message save');
        return;
    }
    
    try {
        // Skip if database is not connected
        if (mongoose.connection.readyState !== 1) {
            console.log('Database not connected - skipping message save');
            return;
        }
        
        // Try to find the user's chat history
        let userChat = await Message.findOne({ userId });
        
        // If it doesn't exist, create a new one
        if (!userChat) {
            userChat = new Message({
                userId,
                messages: []
            });
        }
        
        // Add new message
        userChat.messages.push({
            type,
            content,
            image,
            timestamp: new Date()
        });
        
        // Save changes
        await userChat.save();
        console.log(`Message saved for user ${userId}`);
    } catch (error) {
        console.error("Error saving message:", error);
    }
}

// Add this new helper function
async function saveMessageToSpecificChat(chatId, type, content, image = null) {
    try {
        if (mongoose.connection.readyState !== 1) {
            console.log('Database not connected - skipping message save');
            return;
        }
        
        const chat = await Message.findById(chatId);
        if (!chat) {
            console.log(`Chat with ID ${chatId} not found`);
            return;
        }
        
        chat.messages.push({
            type,
            content,
            image,
            timestamp: new Date()
        });
        
        chat.updatedAt = new Date();
        await chat.save();
        console.log(`Message saved to chat ${chatId}`);
    } catch (error) {
        console.error("Error saving message to specific chat:", error);
    }
}

// Replace your existing server listener with this:
const server = app.listen(port, '0.0.0.0', () => {
    const localIpAddress = getLocalIpAddress();
    console.log(`Chatbot server running on port ${port}`);
    console.log(`Access locally: http://localhost:${port}`);
    console.log(`Access on network: http://${localIpAddress}:${port}`);
});

// Add this helper function to get your local IP address
function getLocalIpAddress() {
    const { networkInterfaces } = require('os');
    const nets = networkInterfaces();
    
    for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
            // Skip over non-IPv4 and internal addresses
            if (net.family === 'IPv4' && !net.internal) {
                return net.address;
            }
        }
    }
    return 'localhost';
}