'use client';

import { useEffect, useRef } from 'react';
import { useAppSelector } from '@/lib/hooks';
import { selectPlayhead, selectPlaying, selectVideoDoc } from '@/lib/features/video/videoSlice';
import type { Clip, Track } from '@/lib/video/types';

function activeClips(track: Track, t: number): Clip[] {
  return track.clips.filter((c) => t >= c.start && t < c.start + c.duration);
}

/**
 * Composites the frame at the current playhead: the active video/image on the
 * video track, text on the overlay track, and drives <video>/<audio> elements
 * for real media. Seeking is only forced when paused or when the drift from
 * expected time is large, so native playback isn't fought frame-by-frame.
 */
export function VideoPreview() {
  const doc = useAppSelector(selectVideoDoc);
  const playhead = useAppSelector(selectPlayhead);
  const playing = useAppSelector(selectPlaying);
  const videoRef = useRef<HTMLVideoElement>(null);

  const videoTrack = doc.tracks.find((t) => t.kind === 'video');
  const overlayTrack = doc.tracks.find((t) => t.kind === 'overlay');
  const audioTrack = doc.tracks.find((t) => t.kind === 'audio');

  const videoClip = videoTrack ? activeClips(videoTrack, playhead)[0] : undefined;
  const overlays = overlayTrack ? activeClips(overlayTrack, playhead) : [];
  const audioClips = audioTrack && !audioTrack.muted ? activeClips(audioTrack, playhead) : [];

  // Sync the <video> element's time/playback with the timeline.
  useEffect(() => {
    const el = videoRef.current;
    if (!el || !videoClip || videoClip.kind !== 'video') return;
    const expected = (videoClip.trimIn + (playhead - videoClip.start) * videoClip.speed) / 1000;
    if (!playing || Math.abs(el.currentTime - expected) > 0.3) {
      el.currentTime = expected;
    }
    el.playbackRate = videoClip.speed;
    el.volume = videoClip.volume;
    if (playing) void el.play().catch(() => undefined);
    else el.pause();
  }, [playing, playhead, videoClip]);

  const ratio = doc.width / doc.height;

  return (
    <div className="flex h-full items-center justify-center p-4">
      <div
        className="relative max-h-full max-w-full overflow-hidden shadow-lg"
        style={{ aspectRatio: `${ratio}`, background: doc.background, width: '100%' }}
      >
        {/* Base video / image layer */}
        {videoClip?.kind === 'video' && (
          <video ref={videoRef} src={videoClip.src} className="absolute inset-0 h-full w-full object-contain" playsInline muted={videoClip.volume === 0} />
        )}
        {videoClip?.kind === 'image' && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={videoClip.src} alt="" className="absolute inset-0 h-full w-full object-contain" />
        )}

        {/* Overlay/text layer */}
        {overlays.map((c) =>
          c.kind === 'text' ? (
            <div
              key={c.id}
              className="absolute inset-0 flex items-center justify-center px-8 text-center"
              style={{ color: c.fill, fontSize: `${(c.fontSize ?? 64) / 10}cqw`, fontWeight: 700 }}
            >
              {c.text}
            </div>
          ) : c.kind === 'image' ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={c.id} src={c.src} alt="" className="absolute inset-0 h-full w-full object-contain" />
          ) : null,
        )}

        {!videoClip && overlays.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-white/50">
            Add clips to the timeline to preview
          </div>
        )}

        {/* Hidden audio elements for the audio track */}
        {audioClips.map((c) => (
          <audio key={c.id} src={c.src} autoPlay={playing} />
        ))}
      </div>
    </div>
  );
}
