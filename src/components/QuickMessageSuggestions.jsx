import React from 'react';
import { Button } from '@/components/ui/button';
import { MessageSquare } from 'lucide-react';

const SUGGESTIONS = {
  sender_to_driver: [
    "Can you deliver to my area?",
    "When are you heading out?",
    "What's the price for this route?"
  ],
  driver_to_sender: [
    "What size is the item?",
    "Where's the pickup location?",
    "When do you need it delivered?"
  ]
};

export default function QuickMessageSuggestions({ viewerMode, onSelect, onMessage }) {
  const suggestions = viewerMode === 'sender' 
    ? SUGGESTIONS.sender_to_driver 
    : SUGGESTIONS.driver_to_sender;

  const modeColor = viewerMode === 'driver' ? '#2FB5C0' : '#FF7A00';

  return (
    <div className="space-y-3">
      <Button
        onClick={onMessage}
        className="w-full h-12 rounded-xl font-semibold"
        style={{ backgroundColor: modeColor, color: '#FFFFFF' }}
      >
        <MessageSquare className="w-5 h-5 mr-2" />
        Message
      </Button>

      <div className="space-y-2">
        <p className="text-sm text-gray-600 font-medium">Quick suggestions:</p>
        <div className="flex flex-wrap gap-2">
          {suggestions.map((text, idx) => (
            <button
              key={idx}
              onClick={() => onSelect(text)}
              className="text-sm px-3 py-1.5 rounded-full border-2 hover:bg-gray-50 transition-colors"
              style={{ borderColor: modeColor, color: modeColor }}
            >
              {text}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}