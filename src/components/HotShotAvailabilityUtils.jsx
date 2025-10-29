// Utility functions for Hot Shot availability computation

export function isWithinTimeWindow(now, window, timezone = 'America/Vancouver') {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dayName = days[now.getDay()];
  
  if (!window.days.includes(dayName)) {
    return false;
  }
  
  const [startHour, startMin] = window.start.split(':').map(Number);
  const [endHour, endMin] = window.end.split(':').map(Number);
  
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;
  
  return nowMinutes >= startMinutes && nowMinutes <= endMinutes;
}

export function computeAvailability(windows, blackoutDates = [], timezone = 'America/Vancouver') {
  if (!windows || windows.length === 0) {
    return { availableNow: false, nextAvailable: null };
  }
  
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  
  // Check if today is blacked out
  if (blackoutDates && blackoutDates.includes(todayStr)) {
    return { availableNow: false, nextAvailable: findNextAvailable(windows, blackoutDates, timezone) };
  }
  
  // Check if currently within any window
  const availableNow = windows.some(window => isWithinTimeWindow(now, window, timezone));
  
  if (availableNow) {
    // Find when current window ends
    const currentWindow = windows.find(window => isWithinTimeWindow(now, window, timezone));
    if (currentWindow) {
      const [endHour, endMin] = currentWindow.end.split(':').map(Number);
      const endTime = new Date(now);
      endTime.setHours(endHour, endMin, 0, 0);
      return { availableNow: true, availableUntil: endTime.toISOString() };
    }
  }
  
  return { availableNow: false, nextAvailable: findNextAvailable(windows, blackoutDates, timezone) };
}

function findNextAvailable(windows, blackoutDates = [], timezone = 'America/Vancouver') {
  const now = new Date();
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  
  // Check next 14 days
  for (let dayOffset = 0; dayOffset < 14; dayOffset++) {
    const checkDate = new Date(now);
    checkDate.setDate(checkDate.getDate() + dayOffset);
    const checkDateStr = checkDate.toISOString().split('T')[0];
    
    if (blackoutDates && blackoutDates.includes(checkDateStr)) {
      continue;
    }
    
    const dayName = days[checkDate.getDay()];
    
    // Find windows for this day
    const dayWindows = windows.filter(w => w.days.includes(dayName));
    
    for (const window of dayWindows) {
      const [startHour, startMin] = window.start.split(':').map(Number);
      const windowStart = new Date(checkDate);
      windowStart.setHours(startHour, startMin, 0, 0);
      
      // If this is today and the window hasn't started yet, or any future day
      if (windowStart > now) {
        return windowStart.toISOString();
      }
    }
  }
  
  return null;
}

export function formatAvailabilityStatus(availableNow, availableUntil, nextAvailable, timezone = 'America/Vancouver') {
  if (availableNow && availableUntil) {
    const until = new Date(availableUntil);
    const timeStr = until.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
    return { 
      type: 'available', 
      text: `Available now until ${timeStr}`,
      color: 'bg-green-100 text-green-800'
    };
  }
  
  if (nextAvailable) {
    const next = new Date(nextAvailable);
    const dayStr = next.toLocaleDateString('en-US', { weekday: 'short' });
    const timeStr = next.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
    return { 
      type: 'next', 
      text: `Next available: ${dayStr} ${timeStr}`,
      color: 'bg-blue-100 text-blue-800'
    };
  }
  
  return { 
    type: 'unavailable', 
    text: 'No availability set',
    color: 'bg-gray-100 text-gray-600'
  };
}

export function formatAvailabilityWindows(windows) {
  if (!windows || windows.length === 0) {
    return 'No schedule set';
  }
  
  return windows.map(window => {
    const days = window.days.join(', ');
    return `${days}: ${window.start}-${window.end}`;
  }).join(' • ');
}