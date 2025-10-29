import React from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { X, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function HotShotAvailabilityPicker({ windows, onChange, errors = {} }) {
  const addWindow = () => {
    onChange([...windows, { days: [], start: '09:00', end: '17:00' }]);
  };

  const removeWindow = (index) => {
    onChange(windows.filter((_, i) => i !== index));
  };

  const updateWindow = (index, field, value) => {
    const updated = [...windows];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  const toggleDay = (windowIndex, day) => {
    const window = windows[windowIndex];
    const days = window.days.includes(day)
      ? window.days.filter(d => d !== day)
      : [...window.days, day];
    updateWindow(windowIndex, 'days', days);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium text-[#333F48]">Weekly Availability</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addWindow}
          className="h-7 text-xs"
        >
          <Plus className="w-3 h-3 mr-1" />
          Add Window
        </Button>
      </div>

      {windows.length === 0 && (
        <p className="text-xs text-[#7C8B96] text-center py-4 bg-gray-50 rounded-lg">
          No availability windows set. Add at least one to activate Hot Shot.
        </p>
      )}

      {windows.map((window, index) => (
        <div
          key={index}
          className="border border-[#E7E9EB] rounded-lg p-3 bg-white space-y-2"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#333F48]">
              Window {index + 1}
            </span>
            <button
              type="button"
              onClick={() => removeWindow(index)}
              className="text-red-500 hover:text-red-700"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div>
            <Label className="text-[10px] text-[#7C8B96] mb-1 block">Days</Label>
            <div className="flex flex-wrap gap-1">
              {DAYS.map((day) => (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleDay(index, day)}
                  className={cn(
                    "pill-chip h-7 px-3 text-xs font-semibold rounded-full transition-all",
                    window.days.includes(day)
                      ? "bg-[#2FB5C0] border-[#2FB5C0] text-white"
                      : "bg-transparent border-[#E7E9EB] text-[#333F48]"
                  )}
                >
                  {day}
                </button>
              ))}
            </div>
            {errors[`window${index}Days`] && (
              <p className="text-xs text-red-600 mt-1">{errors[`window${index}Days`]}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[10px] text-[#7C8B96] mb-1 block">Start Time</Label>
              <Input
                type="time"
                value={window.start}
                onChange={(e) => updateWindow(index, 'start', e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div>
              <Label className="text-[10px] text-[#7C8B96] mb-1 block">End Time</Label>
              <Input
                type="time"
                value={window.end}
                onChange={(e) => updateWindow(index, 'end', e.target.value)}
                className="h-8 text-xs"
              />
            </div>
          </div>
          {errors[`window${index}Time`] && (
            <p className="text-xs text-red-600">{errors[`window${index}Time`]}</p>
          )}
        </div>
      ))}

      <p className="text-[10px] text-[#7C8B96]">
        Set when you're available for Hot Shot deliveries. You can add multiple time windows.
      </p>
    </div>
  );
}