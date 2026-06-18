import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Phone, PhoneOff, Video, VideoOff, Mic, MicOff, Volume2, VolumeX } from 'lucide-react';
import socket from '../socket';

// ─── WebRTC Configuration ─────────────────────────────────
const RTC_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};

// ─── Call Timer ────────────────────────────────────────────
const CallTimer = ({ active }) => {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setSeconds(s => s + 1), 1000);
    return () => clearInterval(id);
  }, [active]);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const fmt = (n) => String(n).padStart(2, '0');
  return (
    <span className="text-slate-300 text-sm font-mono">
      {h > 0 ? `${fmt(h)}:` : ''}{fmt(m)}:{fmt(s)}
    </span>
  );
};

// ─── Incoming Call Banner ─────────────────────────────────
export const IncomingCallBanner = ({ callInfo, onAccept, onReject }) => {
  if (!callInfo) return null;
  return (
    <div className="fixed top-4 right-4 z-[999] bg-slate-900 border border-slate-700 rounded-2xl p-4 shadow-2xl w-80 animate-slideDown">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
          {callInfo.callerInfo?.name?.charAt(0)?.toUpperCase() || '?'}
        </div>
        <div className="flex-1">
          <p className="text-white font-semibold">{callInfo.callerInfo?.name || 'Unknown'}</p>
          <p className="text-violet-400 text-sm flex items-center gap-1">
            {callInfo.callType === 'video' ? (
              <><Video className="w-3 h-3" /> Incoming video call</>
            ) : (
              <><Phone className="w-3 h-3" /> Incoming voice call</>
            )}
          </p>
        </div>
      </div>
      <div className="flex gap-3">
        <button
          onClick={onReject}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-red-500 hover:bg-red-600 rounded-xl text-white font-medium transition-colors"
        >
          <PhoneOff className="w-4 h-4" /> Decline
        </button>
        <button
          onClick={onAccept}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-emerald-500 hover:bg-emerald-600 rounded-xl text-white font-medium transition-colors"
        >
          <Phone className="w-4 h-4" /> Accept
        </button>
      </div>
    </div>
  );
};

// ─── Main Video Call Modal ─────────────────────────────────
const VideoCallModal = ({
  isOpen,
  onClose,
  callType,          // 'video' | 'audio'
  remoteUser,        // { _id, name, avatar }
  isIncoming,        // bool
  incomingOffer,     // RTCSessionDescriptionInit (if incoming)
  callerSocketId,    // socket id of caller (if incoming)
  currentUserId,
}) => {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerRef = useRef(null);
  const localStreamRef = useRef(null);

  const [callState, setCallState] = useState('connecting'); // connecting | ringing | active | ended
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isSpeakerOff, setIsSpeakerOff] = useState(false);
  const [callActive, setCallActive] = useState(false);

  // ── Create peer connection ────────────────────────────────
  const createPeerConnection = useCallback(() => {
    const pc = new RTCPeerConnection(RTC_CONFIG);

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        socket.emit('ice-candidate', { to: remoteUser._id, candidate: e.candidate });
      }
    };

    pc.ontrack = (e) => {
      if (remoteVideoRef.current && e.streams[0]) {
        remoteVideoRef.current.srcObject = e.streams[0];
        setCallState('active');
        setCallActive(true);
      }
    };

    pc.onconnectionstatechange = () => {
      if (['disconnected', 'failed', 'closed'].includes(pc.connectionState)) {
        endCall();
      }
    };

    return pc;
  }, [isIncoming, callerSocketId, remoteUser]);

  // ── Get local media ────────────────────────────────────────
  const getLocalMedia = async () => {
    const constraints = {
      audio: true,
      video: callType === 'video' ? { width: 1280, height: 720, facingMode: 'user' } : false,
    };
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    localStreamRef.current = stream;
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = stream;
    }
    return stream;
  };

  // ── Start outgoing call ───────────────────────────────────
  const startCall = async () => {
    try {
      setCallState('ringing');
      const stream = await getLocalMedia();
      const pc = createPeerConnection();
      peerRef.current = pc;

      stream.getTracks().forEach(t => pc.addTrack(t, stream));

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      socket.emit('call-user', {
        to: remoteUser._id,
        offer: pc.localDescription,
        callerInfo: { name: 'You', userId: currentUserId },
        callType,
      });
    } catch (err) {
      console.error('Start call error:', err);
      setCallState('ended');
    }
  };

  // ── Answer incoming call ──────────────────────────────────
  const answerCall = async () => {
    try {
      setCallState('connecting');
      const stream = await getLocalMedia();
      const pc = createPeerConnection();
      peerRef.current = pc;

      stream.getTracks().forEach(t => pc.addTrack(t, stream));

      await pc.setRemoteDescription(new RTCSessionDescription(incomingOffer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socket.emit('call-accepted', {
        to: remoteUser._id,
        answer: pc.localDescription,
      });
    } catch (err) {
      console.error('Answer call error:', err);
    }
  };

  // ── End call ─────────────────────────────────────────────
  const endCall = useCallback(() => {
    socket.emit('end-call', { to: remoteUser._id });
    cleanup();
    onClose();
  }, [remoteUser, onClose]);

  const cleanup = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    }
    if (peerRef.current) {
      peerRef.current.close();
      peerRef.current = null;
    }
    setCallState('ended');
    setCallActive(false);
  };

  // ── Socket event listeners ────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;

    const onCallAccepted = async ({ answer }) => {
      if (peerRef.current) {
        await peerRef.current.setRemoteDescription(new RTCSessionDescription(answer));
      }
    };

    const onIceCandidate = async ({ candidate }) => {
      if (peerRef.current && candidate) {
        try {
          await peerRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (_) {}
      }
    };

    const onCallRejected = ({ reason }) => {
      setCallState('ended');
      setTimeout(onClose, 1500);
    };

    const onCallEnded = () => {
      cleanup();
      onClose();
    };

    socket.on('call-accepted', onCallAccepted);
    socket.on('ice-candidate', onIceCandidate);
    socket.on('call-rejected', onCallRejected);
    socket.on('call-ended', onCallEnded);

    // Auto-start or answer
    if (!isIncoming) {
      startCall();
    } else {
      setCallState('ringing');
      answerCall();
    }

    return () => {
      socket.off('call-accepted', onCallAccepted);
      socket.off('ice-candidate', onIceCandidate);
      socket.off('call-rejected', onCallRejected);
      socket.off('call-ended', onCallEnded);
      cleanup();
    };
  }, [isOpen]);

  // ── Controls ──────────────────────────────────────────────
  const toggleMute = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(t => { t.enabled = isMuted; });
      setIsMuted(!isMuted);
    }
  };

  const toggleCamera = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach(t => { t.enabled = isCameraOff; });
      setIsCameraOff(!isCameraOff);
    }
  };

  const toggleSpeaker = () => {
    if (remoteVideoRef.current) {
      remoteVideoRef.current.muted = !isSpeakerOff;
      setIsSpeakerOff(!isSpeakerOff);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[998] bg-slate-950 flex flex-col">
      {/* Remote Video (fullscreen) */}
      {callType === 'video' ? (
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-900 to-violet-950">
          <div className="text-center">
            <div className="w-28 h-28 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-white text-5xl font-bold mx-auto mb-4 shadow-2xl">
              {remoteUser?.name?.charAt(0)?.toUpperCase() || '?'}
            </div>
            <p className="text-white text-xl font-semibold">{remoteUser?.name}</p>
          </div>
        </div>
      )}

      {/* Overlay gradient */}
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-transparent to-slate-950/40 pointer-events-none" />

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between px-6 pt-8">
        <div>
          <p className="text-white/60 text-sm uppercase tracking-wider font-medium">
            {callType === 'video' ? 'Video Call' : 'Voice Call'}
          </p>
          <p className="text-white text-xl font-semibold mt-0.5">{remoteUser?.name}</p>
          <div className="mt-1">
            {callState === 'ringing' && <span className="text-violet-400 text-sm animate-pulse">Connecting...</span>}
            {callState === 'connecting' && <span className="text-yellow-400 text-sm animate-pulse">Setting up...</span>}
            {callState === 'active' && <CallTimer active={callActive} />}
            {callState === 'ended' && <span className="text-red-400 text-sm">Call ended</span>}
          </div>
        </div>
      </div>

      {/* Local video (picture-in-picture) */}
      {callType === 'video' && (
        <div className="absolute top-24 right-4 z-20 w-32 h-44 rounded-2xl overflow-hidden border-2 border-white/20 shadow-xl bg-slate-800">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className={`w-full h-full object-cover ${isCameraOff ? 'opacity-0' : ''}`}
          />
          {isCameraOff && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-800">
              <VideoOff className="w-8 h-8 text-slate-400" />
            </div>
          )}
        </div>
      )}

      {/* Audio only — show local muted audio */}
      {callType === 'audio' && (
        <video ref={localVideoRef} autoPlay playsInline muted className="hidden" />
      )}

      {/* Controls */}
      <div className="absolute bottom-0 left-0 right-0 z-10 flex items-center justify-center gap-5 pb-12">
        {/* Mute */}
        <button
          onClick={toggleMute}
          className={`w-14 h-14 rounded-full flex items-center justify-center transition-all shadow-lg ${
            isMuted ? 'bg-red-500 hover:bg-red-600' : 'bg-white/10 hover:bg-white/20 backdrop-blur-sm'
          }`}
          title={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted ? <MicOff className="w-6 h-6 text-white" /> : <Mic className="w-6 h-6 text-white" />}
        </button>

        {/* Camera (video only) */}
        {callType === 'video' && (
          <button
            onClick={toggleCamera}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-all shadow-lg ${
              isCameraOff ? 'bg-red-500 hover:bg-red-600' : 'bg-white/10 hover:bg-white/20 backdrop-blur-sm'
            }`}
            title={isCameraOff ? 'Turn on camera' : 'Turn off camera'}
          >
            {isCameraOff ? <VideoOff className="w-6 h-6 text-white" /> : <Video className="w-6 h-6 text-white" />}
          </button>
        )}

        {/* End Call */}
        <button
          onClick={endCall}
          className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-all shadow-xl scale-110"
          title="End call"
        >
          <PhoneOff className="w-7 h-7 text-white" />
        </button>

        {/* Speaker */}
        <button
          onClick={toggleSpeaker}
          className={`w-14 h-14 rounded-full flex items-center justify-center transition-all shadow-lg ${
            isSpeakerOff ? 'bg-red-500 hover:bg-red-600' : 'bg-white/10 hover:bg-white/20 backdrop-blur-sm'
          }`}
          title={isSpeakerOff ? 'Unmute speaker' : 'Mute speaker'}
        >
          {isSpeakerOff ? <VolumeX className="w-6 h-6 text-white" /> : <Volume2 className="w-6 h-6 text-white" />}
        </button>
      </div>

      <style>{`
        @keyframes slideDown {
          from { transform: translateY(-20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .animate-slideDown { animation: slideDown 0.3s ease-out; }
      `}</style>
    </div>
  );
};

export default VideoCallModal;