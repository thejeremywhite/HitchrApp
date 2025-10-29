
import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  // SheetDescription, // This is removed as jobContext moves into SheetTitle
} from "@/components/ui/sheet";
import { Send, X, Image as ImageIcon, File, User as UserIcon, Truck, Package } from "lucide-react"; // Added Truck and Package
import { format } from "date-fns";
import { toast } from "sonner";

const QUICK_TEMPLATES = [
  "Payment received and confirmed ✅",
  "Please upload receipt for verification",
  "ID verification required",
  "Are you on the way?",
  "Please confirm pickup completed",
  "Thank you for using Hitchr!",
];

export default function AdminMessageDrawer({ open, onClose, userId, userName, jobId, jobContext }) {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState('');
  const [threadId, setThreadId] = useState(null);
  const [targetUser, setTargetUser] = useState(null); // Added targetUser state
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Load target user info
  useEffect(() => {
    const loadUser = async () => {
      if (!userId) return;
      try {
        const user = await base44.entities.User.get(userId); // Use get instead of list + find for efficiency
        setTargetUser(user);
      } catch (error) {
        console.error("Failed to load user:", error);
      }
    };
    loadUser();
  }, [userId]);

  // Find or create thread
  useEffect(() => {
    const initThread = async () => {
      if (!open || !userId) return;

      try {
        const adminUser = await base44.auth.me();
        const participants = [adminUser.id, userId].sort();
        
        // Check for existing thread
        const allThreads = await base44.entities.Thread.list();
        let existingThread = allThreads.find(t => 
          JSON.stringify(t.participants?.sort()) === JSON.stringify(participants)
        );

        if (!existingThread) {
          // Create new thread
          existingThread = await base44.asServiceRole.entities.Thread.create({
            participants,
            lastMessageAt: new Date().toISOString(),
            lastMessagePreview: "Admin conversation started",
            unreadCounts: { [userId]: 0, [adminUser.id]: 0 },
            lastRelatedListing: jobId ? {
              listingId: jobId,
              title: jobContext || "Job",
              roleOfOwner: "admin"
            } : null
          });
        }

        setThreadId(existingThread.id);
      } catch (error) {
        console.error("Failed to init thread:", error);
        toast.error("Failed to load conversation");
      }
    };

    initThread();
  }, [open, userId, jobId, jobContext]); // Added jobContext to dependency array

  // Fetch messages
  const { data: messages = [] } = useQuery({
    queryKey: ['admin-messages', threadId],
    queryFn: async () => {
      if (!threadId) return [];
      const msgs = await base44.entities.ChatMessage.filter({
        filter: { threadId: { eq: threadId } }
      });
      return msgs.sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
    },
    enabled: !!threadId && open,
    refetchInterval: 5000
  });

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async ({ text, imageUrl }) => {
      const adminUser = await base44.auth.me();
      
      const newMessage = await base44.asServiceRole.entities.ChatMessage.create({
        threadId,
        senderId: adminUser.id,
        type: imageUrl ? 'image' : 'text', // Handle image type
        text: text,
        image_url: imageUrl, // Add image_url field
        readBy: [adminUser.id],
        relatedListing: jobId ? {
          listingId: jobId,
          title: jobContext || "Job",
          roleOfOwner: "admin"
        } : null
      });

      // Update thread
      await base44.asServiceRole.entities.Thread.update(threadId, {
        lastMessageAt: new Date().toISOString(),
        lastMessagePreview: text,
        // Calculate unread counts dynamically for the target user (userId)
        unreadCounts: { 
          [userId]: (messages.filter(m => !m.readBy?.includes(userId) && m.senderId !== userId).length + 1), // Increment if not read by target user and sent by admin
          [adminUser.id]: 0 
        }
      });

      return newMessage;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-messages', threadId] });
      setMessage('');
    },
    onError: (error) => {
      console.error("Failed to send message:", error);
      toast.error("Failed to send message");
    }
  });

  const handleSend = () => {
    if (!message.trim()) return;
    sendMessageMutation.mutate({ text: message });
  };

  const handleTemplate = (template) => {
    setMessage(template);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      // Assuming a direct file upload and get URL
      // This is a placeholder for your actual file upload logic using base44.integrations.Core.UploadFile
      // The previous code had `file_url`, assuming it's returned directly.
      const uploadResponse = await base44.integrations.Core.UploadFile({ file });
      const file_url = uploadResponse.file_url || uploadResponse.url; // Adjust based on actual API response
      
      sendMessageMutation.mutate({ 
        text: `📎 Attachment: ${file.name}`, 
        imageUrl: file_url 
      });
      // Clear the file input value to allow re-uploading the same file
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error("Failed to upload file:", error);
      toast.error("Failed to upload file");
    }
  };

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent 
        side="right" 
        className="w-full sm:max-w-lg overflow-y-auto"
        style={{ backgroundColor: '#FFFFFF' }}
      >
        <SheetHeader className="border-b pb-4">
          <SheetTitle className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold">
                {userName?.charAt(0) || 'U'}
              </div>
              <div>
                <p className="text-base font-semibold">{userName}</p>
                {targetUser && (
                  <div className="flex items-center gap-2 mt-1">
                    <Badge 
                      style={{
                        backgroundColor: targetUser.current_mode === 'driver' ? '#E6F9FB' : '#FFE8D6',
                        color: targetUser.current_mode === 'driver' ? '#2FB5C0' : '#FF7A00',
                        fontSize: '10px',
                        padding: '2px 8px',
                        height: 'auto' // Allow badge height to adjust to content
                      }}
                      className="capitalize"
                    >
                      {targetUser.current_mode === 'driver' ? <Truck className="w-2.5 h-2.5 mr-1 inline-block" /> : <Package className="w-2.5 h-2.5 mr-1 inline-block" />}
                      {targetUser.current_mode || 'sender'}
                    </Badge>
                    {jobContext && (
                      <span className="text-[10px] text-gray-500">{jobContext}</span>
                    )}
                  </div>
                )}
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </SheetTitle>
        </SheetHeader>

        {/* Quick Templates */}
        <div className="py-3 border-b">
          <p className="text-xs font-semibold text-gray-600 mb-2">Quick Templates</p>
          <div className="flex flex-wrap gap-1">
            {QUICK_TEMPLATES.map((template, idx) => (
              <button
                key={idx}
                onClick={() => handleTemplate(template)}
                className="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded-full hover:bg-blue-100 transition-colors"
              >
                {template.length > 20 ? `${template.substring(0, 20)}...` : template}
              </button>
            ))}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto py-4 space-y-3 h-[calc(100vh-340px)]">
          {messages.map((msg) => {
            const isAdmin = msg.senderId !== userId; // Assuming userId is the non-admin user
            return (
              <div
                key={msg.id}
                className={`flex ${isAdmin ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[80%] rounded-xl px-4 py-2 ${
                  isAdmin 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-100 text-gray-900'
                }`}>
                  {!isAdmin && (
                    <Badge variant="outline" className="mb-1 text-xs">
                      {userName}
                    </Badge>
                  )}
                  {msg.type === 'image' && msg.image_url ? (
                    <div className="mb-2">
                      <img src={msg.image_url} alt="Attachment" className="max-w-full h-auto rounded-lg" />
                      {msg.text && <p className="text-sm whitespace-pre-wrap mt-1">{msg.text}</p>}
                    </div>
                  ) : (
                    <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                  )}
                  <p className={`text-xs mt-1 ${isAdmin ? 'text-blue-100' : 'text-gray-500'}`}>
                    {format(new Date(msg.created_date), 'HH:mm')}
                  </p>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t pt-4">
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleFileUpload}
              accept="image/*,.pdf"
            />
            <Button
              variant="outline"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
              className="flex-shrink-0"
            >
              <ImageIcon className="w-4 h-4" />
            </Button>
            <Input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
              placeholder="Type a message..."
              className="flex-1"
            />
            <Button
              onClick={handleSend}
              disabled={!message.trim() || sendMessageMutation.isPending}
              className="flex-shrink-0"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
