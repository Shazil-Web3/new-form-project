import React from 'react';

// YouTube / Vimeo page links cannot be played by a <video> tag, so turn them into embed URLs.
// Anything else (uploaded mp4/webm etc.) keeps the plain <video> player.
export function toEmbedUrl(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '');
    if (host === 'youtu.be') {
      const id = u.pathname.slice(1).split('/')[0];
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
      if (u.pathname === '/watch') {
        const id = u.searchParams.get('v');
        return id ? `https://www.youtube.com/embed/${id}` : null;
      }
      const m = u.pathname.match(/^\/(?:embed|shorts|live|v)\/([^/?]+)/);
      return m ? `https://www.youtube.com/embed/${m[1]}` : null;
    }
    if (host === 'vimeo.com') {
      const id = u.pathname.split('/').filter(Boolean)[0];
      return /^\d+$/.test(id || '') ? `https://player.vimeo.com/video/${id}` : null;
    }
    if (host === 'player.vimeo.com') return url;
  } catch (e) {
    return null;
  }
  return null;
}

export default function ClassVideo({ url, title }) {
  const embed = toEmbedUrl(url);
  if (embed) {
    return (
      <iframe
        src={embed}
        title={title}
        className="aspect-video w-full"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    );
  }
  return (
    <video src={url} controls className="max-h-[70vh] w-full bg-black">
      <source src={url} />
    </video>
  );
}
