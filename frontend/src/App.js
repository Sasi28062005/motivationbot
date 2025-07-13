import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Chatbot from './components/Chatbot';
import ChatSelection from './components/ChatSelection';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<ChatSelection />} />
        <Route path="/chat" element={<Chatbot />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;


