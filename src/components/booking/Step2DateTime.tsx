'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Calendar, Clock, ChevronLeft } from 'lucide-react';

interface Step2DateTimeProps {
  selectedDate: Date | null;
  selectedTime: string | null;
  onUpdate: (data: { selectedDate: Date | null; selectedTime: string | null }) => void;
  onNext: () => void;
  onBack: () => void;
}

const BOOKING_HOURS = {
  monday: { start: '09:00', end: '17:00' },
  tuesday: { start: '09:00', end: '17:00' },
  wednesday: { start: '09:00', end: '17:00' },
  thursday: { start: '09:00', end: '17:00' },
  friday: { start: '09:00', end: '17:00' },
  saturday: { start: '09:00', end: '17:00' },
  sunday: { start: null, end: null }, // Closed
};

const SLOT_INTERVAL = 30; // 30-minute slots

export default function Step2DateTime({
  selectedDate,
  selectedTime,
  onUpdate,
  onNext,
  onBack,
}: Step2DateTimeProps) {
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);

  // Generate time slots for the selected date
  useEffect(() => {
    if (!selectedDate) return;

    const dayOfWeek = selectedDate.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase() as keyof typeof BOOKING_HOURS;
    const hours = BOOKING_HOURS[dayOfWeek];

    if (!hours.start || !hours.end) {
      setAvailableSlots([]);
      return;
    }

    const slots: string[] = [];
    const [startHour, startMin] = hours.start.split(':').map(Number);
    const [endHour, endMin] = hours.end.split(':').map(Number);

    let currentHour = startHour;
    let currentMin = startMin;

    while (currentHour < endHour || (currentHour === endHour && currentMin < endMin)) {
      const timeString = `${String(currentHour).padStart(2, '0')}:${String(currentMin).padStart(2, '0')}`;
      slots.push(timeString);

      currentMin += SLOT_INTERVAL;
      if (currentMin >= 60) {
        currentMin = 0;
        currentHour += 1;
      }
    }

    setAvailableSlots(slots);
  }, [selectedDate]);

  // Generate calendar days for current month
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay();

    const days: (Date | null)[] = [];

    // Add empty slots for days before the month starts
    for (let i = 0; i < startDayOfWeek; i++) {
      days.push(null);
    }

    // Add all days in the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }

    return days;
  };

  const isDateAvailable = (date: Date | null) => {
    if (!date) return false;
    const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase() as keyof typeof BOOKING_HOURS;
    const hours = BOOKING_HOURS[dayOfWeek];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date >= today && hours.start !== null;
  };

  const handleDateSelect = (date: Date) => {
    if (isDateAvailable(date)) {
      onUpdate({ selectedDate: date, selectedTime: null });
    }
  };

  const handleTimeSelect = (time: string) => {
    onUpdate({ selectedDate, selectedTime: time });
  };

  const handleSubmit = () => {
    if (selectedDate && selectedTime) {
      onNext();
    }
  };

  const formatTime = (time: string) => {
    const [hour, min] = time.split(':').map(Number);
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${displayHour}:${String(min).padStart(2, '0')} ${period}`;
  };

  const days = getDaysInMonth(calendarDate);
  const monthName = calendarDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.2 }}
      className="space-y-6"
    >
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-obsidian mb-2">Choose a date & time</h2>
        <p className="text-sm text-obsidian/60">
          Select your preferred appointment slot
        </p>
      </div>

      {/* Calendar */}
      <div className="bg-surgical-50 rounded-xl p-4 border border-surgical-200">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1))}
            className="p-2 hover:bg-white rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h3 className="font-semibold text-obsidian">{monthName}</h3>
          <button
            onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1))}
            className="p-2 hover:bg-white rounded-lg transition-colors rotate-180"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 gap-2 mb-2">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
            <div key={day} className="text-center text-xs font-medium text-obsidian/60">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar days */}
        <div className="grid grid-cols-7 gap-2">
          {days.map((date, index) => {
            const isAvailable = isDateAvailable(date);
            const isSelected = date && selectedDate && date.toDateString() === selectedDate.toDateString();

            return (
              <button
                key={index}
                onClick={() => date && handleDateSelect(date)}
                disabled={!isAvailable}
                className={`aspect-square rounded-lg text-sm font-medium transition-all ${
                  !date
                    ? 'invisible'
                    : isSelected
                    ? 'bg-surgical-600 text-white shadow-lg'
                    : isAvailable
                    ? 'bg-white hover:bg-surgical-100 text-obsidian border border-surgical-200'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }`}
              >
                {date ? date.getDate() : ''}
              </button>
            );
          })}
        </div>
      </div>

      {/* Time Slots */}
      {selectedDate && availableSlots.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold text-obsidian flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Available times
          </h3>
          <div className="grid grid-cols-3 gap-2 max-h-64 overflow-y-auto pr-2">
            {availableSlots.map((time) => (
              <button
                key={time}
                onClick={() => handleTimeSelect(time)}
                className={`py-2.5 px-3 rounded-lg text-sm font-medium transition-all ${
                  selectedTime === time
                    ? 'bg-surgical-600 text-white shadow-lg'
                    : 'bg-white hover:bg-surgical-50 text-obsidian border border-surgical-200'
                }`}
              >
                {formatTime(time)}
              </button>
            ))}
          </div>
        </div>
      )}

      {selectedDate && availableSlots.length === 0 && (
        <div className="text-center py-8 text-obsidian/60">
          <Calendar className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No available slots for this day</p>
          <p className="text-xs">We're closed on Sundays</p>
        </div>
      )}

      {/* Navigation Buttons */}
      <div className="flex gap-3 pt-4">
        <button
          onClick={onBack}
          className="flex-1 bg-white border border-surgical-200 hover:bg-surgical-50 text-obsidian font-semibold py-3.5 rounded-xl transition-colors"
        >
          Back
        </button>
        <button
          onClick={handleSubmit}
          disabled={!selectedDate || !selectedTime}
          className="flex-1 bg-surgical-600 hover:bg-surgical-700 disabled:bg-surgical-300 disabled:cursor-not-allowed text-white font-semibold py-3.5 rounded-xl transition-colors shadow-lg shadow-surgical-600/30 hover:shadow-surgical-700/40"
        >
          Continue
        </button>
      </div>
    </motion.div>
  );
}
