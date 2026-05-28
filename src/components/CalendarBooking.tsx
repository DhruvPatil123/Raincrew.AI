import React, { useState, useEffect } from 'react';
import { 
  Calendar, Clock, Mail, Video, CheckCircle2, ChevronRight, 
  MapPin, AlertCircle, Copy, Check, Power, Send, Sparkles, 
  UserPlus, User, Loader2
} from 'lucide-react';
import { Candidate, Campaign } from '../types';
import { 
  initAuth, 
  googleSignIn, 
  logout, 
  getAccessToken 
} from '../lib/googleAuth';
import { updateCandidateEvaluation } from '../lib/storage';

interface CalendarBookingProps {
  candidate: Candidate;
  campaign: Campaign;
  onRefreshCandidateData: (updatedCandidate: Candidate) => void;
  isAnonymousMode?: boolean;
}

export default function CalendarBooking({
  candidate,
  campaign,
  onRefreshCandidateData,
  isAnonymousMode = false
}: CalendarBookingProps) {
  // Auth state
  const [needsAuth, setNeedsAuth] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [googleUser, setGoogleUser] = useState<any>(null);
  const [token, setToken] = useState<string | null>(null);

  // Form states
  const [dateStr, setDateStr] = useState('2026-05-28');
  const [timeStr, setTimeStr] = useState('14:00');
  const [durationMin, setDurationMin] = useState(30);
  const [additionalAttendees, setAdditionalAttendees] = useState('');
  const [noteToCandidate, setNoteToCandidate] = useState(
    `Hello! We would love to schedule a follow-up interview to discuss your AI technical screening score for the ${campaign.title} role. Let's dig deeper into your strengths and goals!`
  );

  // Action states
  const [isBooking, setIsBooking] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState<'meet' | 'event' | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Monitor auth status on load
  useEffect(() => {
    const unsubscribe = initAuth(
      (user, cachedToken) => {
        setGoogleUser(user);
        setToken(cachedToken);
        setNeedsAuth(false);
      },
      () => {
        setNeedsAuth(true);
      }
    );
    return () => unsubscribe();
  }, []);

  const handleConnectGoogle = async () => {
    setIsLoggingIn(true);
    setBookingError(null);
    try {
      const result = await googleSignIn();
      if (result) {
        setToken(result.accessToken);
        setGoogleUser(result.user);
        setNeedsAuth(false);
      }
    } catch (e: any) {
      console.error('Failed Google Authorization:', e);
      setBookingError(e?.message || 'Google account authorization failed.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await logout();
      setToken(null);
      setGoogleUser(null);
      setNeedsAuth(true);
    } catch (e) {
      console.error(e);
    }
  };

  const copyText = (text: string, type: 'meet' | 'event') => {
    navigator.clipboard.writeText(text);
    setCopiedLink(type);
    setTimeout(() => setCopiedLink(null), 3000);
  };

  // Build dates to ISO RFC3339 formats
  const getEventDateTime = () => {
    const startDateTimeStr = `${dateStr}T${timeStr}:00`;
    const startObj = new Date(startDateTimeStr);
    
    // Add duration
    const endObj = new Date(startObj.getTime() + durationMin * 60 * 1000);
    
    return {
      startISO: startObj.toISOString(),
      endISO: endObj.toISOString()
    };
  };

  const handleExecuteBooking = async () => {
    setShowConfirmModal(false);
    setIsBooking(true);
    setBookingError(null);

    const accessToken = token || await getAccessToken();
    if (!accessToken) {
      setBookingError('Active OAuth Token was not found. Please log in again.');
      setIsBooking(false);
      return;
    }

    const { startISO, endISO } = getEventDateTime();
    
    // Format attendee list
    const attendeeEmails = [candidate.email];
    if (additionalAttendees.trim()) {
      const extras = additionalAttendees.split(',').map(e => e.trim()).filter(Boolean);
      attendeeEmails.push(...extras);
    }

    const eventResource = {
      summary: `Virtual Interview: ${candidate.name} x FoloUp (${campaign.title})`,
      description: `${noteToCandidate}\n\n---\nAutomated screening scorecard links: Candidate results scored ${candidate.score}% overview fit.\nManaged securely via AI Studio HR Suite.`,
      start: {
        dateTime: startISO,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
      },
      end: {
        dateTime: endISO,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
      },
      attendees: attendeeEmails.map(email => ({ email })),
      conferenceData: {
        createRequest: {
          requestId: `foloup-meet-${Date.now()}`,
          conferenceSolutionKey: {
            type: 'hangoutsMeet'
          }
        }
      }
    };

    try {
      // Call Google Calendar Events API with Meet creation enabled
      const url = 'https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all';
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(eventResource)
      });

      if (!response.ok) {
        const errDetails = await response.json();
        throw new Error(errDetails?.error?.message || 'Failed Google Calendar event creation request.');
      }

      const createdEvent = await response.json();
      
      // Look for Google Meet link inside response blocks
      let meetUrl = '';
      if (createdEvent.conferenceData?.entryPoints) {
        const videoEntryPoint = createdEvent.conferenceData.entryPoints.find(
          (ep: any) => ep.entryPointType === 'video'
        );
        if (videoEntryPoint) {
          meetUrl = videoEntryPoint.uri;
        }
      }

      // Update Local candidate state & Storage object
      const updatedCandidate = updateCandidateEvaluation(candidate.id, {
        interviewStatus: 'Confirmed',
        interviewScheduledDate: startISO,
        interviewEventLink: createdEvent.htmlLink,
        interviewMeetLink: meetUrl
      });

      if (updatedCandidate) {
        onRefreshCandidateData(updatedCandidate);
      }

    } catch (e: any) {
      console.error(e);
      setBookingError(e?.message || 'Integration request yielded Google API errors. Verify your project alignment.');
    } finally {
      setIsBooking(false);
    }
  };

  const handleCancelBooking = async () => {
    // Confirm dialog check
    const isConfirmed = window.confirm(
      `Cancel scheduled interview for ${candidate.name}? This will clear the schedule links locally.`
    );
    if (!isConfirmed) return;

    const updated = updateCandidateEvaluation(candidate.id, {
      interviewStatus: undefined,
      interviewScheduledDate: undefined,
      interviewEventLink: undefined,
      interviewMeetLink: undefined
    });

    if (updated) {
      onRefreshCandidateData(updated);
    }
  };

  return (
    <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-xs space-y-5 dark:bg-slate-900/60 dark:border-slate-800">
      
      {/* Upper header */}
      <div className="flex gap-2.5 items-start justify-between flex-wrap border-b border-slate-50 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-emerald-600 animate-pulse" />
          <div>
            <h3 className="text-xs font-extrabold uppercase tracking-widest text-slate-800 dark:text-slate-200">Google Calendar Schedule Engine</h3>
            <p className="text-[10px] text-slate-400 font-sans leading-none">Instant calendar invites & auto-generated Google Meet rooms</p>
          </div>
        </div>

        {/* If logged in, show connected entity wrapper */}
        {!needsAuth && googleUser && (
          <div className="flex items-center gap-2 bg-emerald-50 text-emerald-800 border border-emerald-100 px-3 py-1 rounded-xl text-[10px] font-mono font-bold dark:bg-emerald-950/20 dark:text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>Connected: {googleUser.email}</span>
            <button
              onClick={handleDisconnect}
              className="text-emerald-600 hover:text-rose-600 transition-colors ml-1"
              type="button"
              title="Disconnect Google API Sync"
            >
              <Power className="w-3.5 h-3.5 text-current" />
            </button>
          </div>
        )}
      </div>

      {/* ERROR HANDLERS */}
      {bookingError && (
        <div className="bg-rose-50 border border-rose-100 p-3 rounded-xl flex items-start gap-2.5 dark:bg-rose-955/10 dark:border-rose-900/35">
          <AlertCircle className="w-4.5 h-4.5 text-rose-600 mt-0.5 flex-shrink-0" />
          <div>
            <span className="text-[10px] font-bold text-rose-800 uppercase font-mono block">Scheduling Block/Fault Detected</span>
            <p className="text-[10.5px] text-rose-700 leading-normal">{bookingError}</p>
          </div>
        </div>
      )}

      {/* CONDITIONAL COMPONENT 1: NOT AUTHENTICATED */}
      {needsAuth ? (
        <div className="py-6 flex flex-col items-center justify-center text-center space-y-4 max-w-sm mx-auto">
          <div className="w-12 h-12 bg-amber-50 rounded-2xl border border-amber-100 text-amber-600 flex items-center justify-center shadow-3xs">
            <Video className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">Authorized Recruiter Sync Missing</h4>
            <p className="text-[10.5px] text-slate-400 max-w-xs mt-1">
              Connecting Google Workspace binds real calendar booking permissions so candidates get real emails, alerts, and video calls.
            </p>
          </div>

          <button 
            type="button"
            onClick={handleConnectGoogle}
            disabled={isLoggingIn}
            className="gsi-material-button text-slate-850 hover:bg-slate-50 transition-colors shadow-md border border-slate-200"
          >
            <div className="gsi-material-button-state"></div>
            <div className="gsi-material-button-content-wrapper">
              <div className="gsi-material-button-icon">
                {isLoggingIn ? (
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                ) : (
                  <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" style={{ display: "block" }}>
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                    <path fill="none" d="M0 0h48v48H0z"></path>
                  </svg>
                )}
              </div>
              <span className="gsi-material-button-contents font-sans text-xs">Sign in with Google Workspace</span>
            </div>
          </button>
        </div>
      ) : (
        /* CONDITIONAL COMPONENT 2: CONNECTED */
        <div className="space-y-4">
          
          {/* STATE A: ACTIVE BOOKING IS ALREADY CONFIRMED */}
          {candidate.interviewStatus === 'Confirmed' ? (
            <div className="bg-emerald-50/50 border border-emerald-100 p-5 rounded-2xl space-y-4 dark:bg-emerald-950/10 dark:border-emerald-850">
              <div className="flex gap-3 items-start">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0 dark:bg-emerald-950">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-widest font-mono">Invite Dispatched successfully</span>
                  <h4 className="text-sm font-extrabold text-slate-800 dark:text-slate-100">Live Interview Meeting Booked</h4>
                  <p className="text-[11px] text-slate-500 leading-normal">
                    An invite was automatically wired to client account email (<strong className="text-slate-700 dark:text-slate-300">{candidate.email}</strong>). Follow-up materials are synchronized.
                  </p>
                </div>
              </div>

              {/* Booking Time and URL Indicators */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-emerald-100/50">
                <div className="space-y-1 text-xs">
                  <div className="flex items-center gap-1.5 text-slate-500 font-medium">
                    <Clock className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Scheduled Date & Time</span>
                  </div>
                  <p className="font-extrabold text-slate-800 dark:text-slate-200">
                    {candidate.interviewScheduledDate 
                      ? new Date(candidate.interviewScheduledDate).toLocaleString(undefined, {
                          weekday: 'long',
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                          timeZoneName: 'short'
                        })
                      : 'Sync mismatch'
                    }
                  </p>
                </div>

                <div className="space-y-2 text-xs">
                  {candidate.interviewMeetLink && (
                    <div className="flex items-center justify-between bg-white dark:bg-slate-900 border border-emerald-150 p-2 rounded-xl">
                      <div className="flex items-center gap-1">
                        <Video className="w-3.5 h-3.5 text-blue-500" />
                        <span className="font-bold text-[10px] text-slate-700 dark:text-slate-300">Google Meet</span>
                      </div>
                      
                      <div className="flex items-center gap-1.5">
                        <a 
                          href={candidate.interviewMeetLink} 
                          target="_blank" 
                          rel="noreferrer"
                          className="px-2 py-0.5 bg-blue-50 text-blue-700 font-bold hover:bg-blue-100 rounded text-[9.5px]"
                        >
                          Join Meet
                        </a>
                        <button
                          onClick={() => copyText(candidate.interviewMeetLink || '', 'meet')}
                          className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600 cursor-pointer"
                          title="Copy meeting link"
                        >
                          {copiedLink === 'meet' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  )}

                  {candidate.interviewEventLink && (
                    <div className="flex items-center justify-between bg-white dark:bg-slate-900 border border-emerald-150 p-2 rounded-xl">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="font-bold text-[10px] text-slate-700 dark:text-slate-300">Calendar Event</span>
                      </div>
                      
                      <div className="flex items-center gap-1.5">
                        <a 
                          href={candidate.interviewEventLink} 
                          target="_blank" 
                          rel="noreferrer"
                          className="px-2 py-0.5 bg-emerald-50 text-emerald-700 font-bold hover:bg-emerald-100 rounded text-[9.5px]"
                        >
                          View Event
                        </a>
                        <button
                          onClick={() => copyText(candidate.interviewEventLink || '', 'event')}
                          className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600 cursor-pointer"
                          title="Copy Calendar event details"
                        >
                          {copiedLink === 'event' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Destructive Cancel schedule button */}
              <div className="flex justify-end pt-2 border-t border-emerald-100/30">
                <button
                  type="button"
                  onClick={handleCancelBooking}
                  className="px-3.5 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-xl transition-all border border-rose-200/50 cursor-pointer"
                >
                  Cancel Interview & Clear Status
                </button>
              </div>
            </div>
          ) : (
            
            /* STATE B: NO BOOKINGS ASSIGNED YET - SHOW FORM */
            <div className="space-y-4">
              
              {/* Form details */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                <div className="space-y-1">
                  <label className="text-[9.5px] uppercase font-bold text-slate-400 block">Interview Date</label>
                  <input
                    type="date"
                    value={dateStr}
                    onChange={(e) => setDateStr(e.target.value)}
                    className="w-full text-xs font-semibold border border-slate-200 px-3 py-2 rounded-xl focus:ring-2 focus:ring-indigo-100 outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9.5px] uppercase font-bold text-slate-400 block">Starting Time</label>
                  <input
                    type="time"
                    value={timeStr}
                    onChange={(e) => setTimeStr(e.target.value)}
                    className="w-full text-xs font-semibold border border-slate-200 px-3 py-2 rounded-xl focus:ring-2 focus:ring-indigo-100 outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9.5px] uppercase font-bold text-slate-400 block">Session Length (Minutes)</label>
                  <select
                    value={durationMin}
                    onChange={(e) => setDurationMin(Number(e.target.value))}
                    className="w-full text-xs font-semibold border border-slate-200 px-3 py-[9px] rounded-xl focus:ring-2 focus:ring-indigo-100 outline-none focus:border-indigo-500"
                  >
                    <option value={15}>15 Minutes (Brief Sync)</option>
                    <option value={30}>30 Minutes (Core Screen)</option>
                    <option value={45}>45 Minutes (Tech Deep Dive)</option>
                    <option value={60}>60 Minutes (Full Panel)</option>
                  </select>
                </div>
              </div>

              {/* Extra emails attendees */}
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="text-[9.5px] uppercase font-bold text-slate-400">Additional Team Attendees</label>
                  <span className="text-[8.5px] text-slate-400 font-mono">Invite other assessors</span>
                </div>
                <div className="relative">
                  <UserPlus className="absolute left-3.5 top-3 w-4 h-4 text-slate-450" />
                  <input
                    type="text"
                    value={additionalAttendees}
                    onChange={(e) => setAdditionalAttendees(e.target.value)}
                    placeholder="hiringmanager@yourcompany.com, techlead@yourcompany.com"
                    className="w-full pl-9 text-xs font-medium border border-slate-200 px-3 py-2 rounded-xl focus:ring-2 focus:ring-indigo-100 outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Custom message note to candidate */}
              <div className="space-y-1">
                <label className="text-[9.5px] uppercase font-bold text-slate-400 block">Greeting Note to Candidate</label>
                <textarea
                  value={noteToCandidate}
                  onChange={(e) => setNoteToCandidate(e.target.value)}
                  rows={2}
                  className="w-full text-xs font-medium border border-slate-200 px-3 py-2 rounded-xl focus:ring-2 focus:ring-indigo-100 outline-none focus:border-indigo-500 resize-none font-sans"
                />
              </div>

              {/* Booking Trigger buttons */}
              <div className="flex justify-between items-center gap-2 pt-2 border-t border-slate-100">
                <div className="hidden sm:flex items-center gap-1.5 text-slate-400 text-[10px]">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Meet video automatically attached</span>
                </div>

                <button
                  type="button"
                  onClick={() => setShowConfirmModal(true)}
                  disabled={isBooking}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold cursor-pointer flex items-center gap-1.5 select-none transition-colors shadow-xs hover:shadow-sm"
                >
                  {isBooking ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Booking event...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5 text-emerald-50" />
                      <span>Book Slot & Email Invite</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Confirmation Dialog Modal as mandated by workspace skill guidelines */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-xl">
            <h4 className="text-sm font-bold text-slate-950 dark:text-white">Confirm Google Calendar Dispatch</h4>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-normal">
              You are about to issue a Calendar Invite via your connected account. This will:
            </p>
            <ul className="list-disc pl-5 text-[11px] text-slate-500 dark:text-slate-450 space-y-1">
              <li>Book an event on your primary Google Calendar.</li>
              <li>Instantly generate a Google Meet virtual room.</li>
              <li>Send email notices with conference coordinates directly to <strong className="text-slate-700 dark:text-slate-350">{candidate.name}</strong>.</li>
            </ul>
            <div className="flex justify-end gap-2.5 text-xs pt-2">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-350 font-semibold rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteBooking}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg cursor-pointer"
              >
                Confirm and Send
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
