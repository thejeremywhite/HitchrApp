
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";
import { toast } from "sonner";

/**
 * Opens or creates a 1:1 chat thread with another user
 * @param {string} peerId - The other user's ID
 * @param {object} relatedListing - Optional listing context {id, title, roleOfOwner}
 * @param {function} navigate - React Router navigate function
 * @returns {Promise<void>}
 */
export const openChat = async (peerId, relatedListing, navigate) => {
  try {
    // Check auth
    const isAuth = await base44.auth.isAuthenticated();
    
    if (!isAuth) {
      sessionStorage.setItem('hitchr.pendingChat', JSON.stringify({
        peerId,
        relatedListing
      }));
      sessionStorage.setItem('hitchr.returnUrl', `/chat/new?peer=${peerId}`);
      base44.auth.redirectToLogin(`/chat/new?peer=${peerId}`);
      return;
    }

    // If authenticated, navigate directly to new chat creation endpoint
    navigate(`/chat/new?peer=${peerId}`, {
      state: { relatedListing }
    });
  } catch (error) {
    console.error("Error opening chat:", error);
    toast.error("Unable to open chat");
  }
};
