import React, { useState } from "react";
import { Modal, Button, Form, Alert } from "react-bootstrap";

/**
 * Helper to convert YouTube URL into Embed URL (handles query params, Shorts, etc.)
 */
export const getYouTubeEmbedUrl = (url) => {
  if (!url) return null;
  const trimmed = url.trim();

  try {
    const parsed = new URL(trimmed);
    let videoId = null;

    if (parsed.hostname.includes("youtube.com")) {
      videoId = parsed.searchParams.get("v");
      if (!videoId && parsed.pathname.startsWith("/embed/")) {
        videoId = parsed.pathname.split("/embed/")[1];
      } else if (!videoId && parsed.pathname.startsWith("/v/")) {
        videoId = parsed.pathname.split("/v/")[1];
      } else if (!videoId && parsed.pathname.startsWith("/shorts/")) {
        videoId = parsed.pathname.split("/shorts/")[1];
      }
    } else if (parsed.hostname.includes("youtu.be")) {
      videoId = parsed.pathname.substring(1);
    }

    if (videoId) {
      videoId = videoId.split("&")[0].split("?")[0].split("/")[0];
      if (videoId.length === 11) {
        const startParam = parsed.searchParams.get("t") || parsed.searchParams.get("start");
        let startQuery = "";
        if (startParam) {
          const cleanSec = parseInt(startParam, 10);
          if (!isNaN(cleanSec)) startQuery = `?start=${cleanSec}`;
        }
        return `https://www.youtube.com/embed/${videoId}${startQuery}`;
      }
    }
  } catch (e) {
    // URL parsing fallback regex
  }

  const regExp = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/ ]{11})/;
  const match = trimmed.match(regExp);
  if (match && match[1]) {
    return `https://www.youtube.com/embed/${match[1]}`;
  }

  return null;
};

/**
 * Helper to detect if a URL is a direct video file or YouTube link
 */
const detectVideoType = (url) => {
  if (!url) return null;
  const trimmed = url.trim();
  if (getYouTubeEmbedUrl(trimmed)) {
    return "youtube";
  }
  if (/\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(trimmed) || trimmed.startsWith("blob:") || trimmed.startsWith("data:video")) {
    return "direct";
  }
  return "direct";
};

const InsertVideoModal = ({ show, onHide, onInsertVideo }) => {
  const [videoUrl, setVideoUrl] = useState("");
  const [localFileName, setLocalFileName] = useState("");
  const [error, setError] = useState("");

  const videoType = detectVideoType(videoUrl);
  const ytEmbedUrl = videoType === "youtube" ? getYouTubeEmbedUrl(videoUrl.trim()) : null;

  const handleClose = () => {
    setVideoUrl("");
    setLocalFileName("");
    setError("");
    onHide();
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("video/")) {
      setError("Please select a valid video file (.mp4, .webm, .mov, etc.).");
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setVideoUrl(objectUrl);
    setLocalFileName(file.name);
    setError("");
  };

  const handleUrlChange = (e) => {
    const val = e.target.value;
    setVideoUrl(val);
    setLocalFileName("");
    if (error) setError("");
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const url = videoUrl.trim();
    if (!url) {
      setError("Please provide a valid video link or select a local video file.");
      return;
    }

    onInsertVideo({
      url,
      type: videoType,
      embedUrl: ytEmbedUrl || url
    });

    handleClose();
  };

  return (
    <Modal show={show} onHide={handleClose} centered className="insert-video-modal">
      <Modal.Header closeButton style={{ borderBottom: "1px solid #e9ecef", background: "#f8f9fa" }}>
        <Modal.Title style={{ fontSize: "1.15rem", fontWeight: "600", color: "#1a1f36" }}>
          <i className="bi bi-film me-2" style={{ color: "#4f46e5" }}></i>
          Insert Video
        </Modal.Title>
      </Modal.Header>
      <Form onSubmit={handleSubmit}>
        <Modal.Body style={{ padding: "20px 24px" }}>
          {error && <Alert variant="danger" style={{ fontSize: "0.875rem", padding: "8px 12px" }}>{error}</Alert>}

          {/* Option 1: Web Video Link / URL */}
          <Form.Group className="mb-3">
            <Form.Label style={{ fontWeight: "500", fontSize: "0.9rem", color: "#344054" }}>
              <i className="bi bi-link-45deg me-1" style={{ color: "#4f46e5" }}></i>
              Video Link / Web URL
            </Form.Label>
            <Form.Control
              type="url"
              placeholder="Paste YouTube link, YouTube Shorts, or direct .mp4 / .webm link..."
              value={videoUrl.startsWith("blob:") ? "" : videoUrl}
              onChange={handleUrlChange}
              autoFocus
              style={{ borderRadius: "6px", fontSize: "0.9rem" }}
            />
            <Form.Text className="text-muted" style={{ fontSize: "0.8rem", marginTop: "4px", display: "block" }}>
              Supports YouTube videos, Shorts, and direct web video links (e.g. <code>.mp4</code>, <code>.webm</code>, <code>.mov</code>).
            </Form.Text>
          </Form.Group>

          {/* Divider */}
          <div className="d-flex align-items-center my-3">
            <div style={{ flex: 1, height: "1px", backgroundColor: "#e5e7eb" }}></div>
            <span
              style={{
                padding: "2px 10px",
                fontSize: "0.75rem",
                fontWeight: "600",
                color: "#6b7280",
                backgroundColor: "#f3f4f6",
                borderRadius: "12px",
                textTransform: "uppercase",
                letterSpacing: "0.5px"
              }}
            >
              OR
            </span>
            <div style={{ flex: 1, height: "1px", backgroundColor: "#e5e7eb" }}></div>
          </div>

          {/* Option 2: Upload Local Video File */}
          <Form.Group className="mb-3">
            <Form.Label style={{ fontWeight: "500", fontSize: "0.9rem", color: "#344054" }}>
              <i className="bi bi-laptop me-1" style={{ color: "#4f46e5" }}></i>
              From Local PC / Hardware
            </Form.Label>
            <Form.Control
              type="file"
              accept="video/mp4,video/webm,video/ogg,video/quicktime"
              onChange={handleFileChange}
              style={{ borderRadius: "6px", fontSize: "0.9rem" }}
            />
            {localFileName && (
              <div style={{ fontSize: "0.8rem", color: "#059669", marginTop: "6px", fontWeight: "500" }}>
                <i className="bi bi-check-circle-fill me-1"></i> Selected local file: {localFileName}
              </div>
            )}
            <Form.Text className="text-muted" style={{ fontSize: "0.8rem", marginTop: "4px", display: "block" }}>
              Select a local video file from your computer hardware (.mp4, .webm, .mov).
            </Form.Text>
          </Form.Group>

          {/* Live Preview Box */}
          {videoUrl.trim() && (
            <div className="mt-3">
              <Form.Label style={{ fontWeight: "500", fontSize: "0.85rem", color: "#475467" }}>
                Preview:
              </Form.Label>
              <div
                style={{
                  background: "#000",
                  borderRadius: "6px",
                  overflow: "hidden",
                  maxHeight: "200px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}
              >
                {videoType === "youtube" && ytEmbedUrl ? (
                  <iframe
                    src={ytEmbedUrl}
                    title="YouTube video preview"
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    style={{ width: "100%", height: "190px", border: 0 }}
                  ></iframe>
                ) : (
                  <video
                    src={videoUrl.trim()}
                    controls
                    style={{ maxWidth: "100%", maxHeight: "190px" }}
                    onError={() => setError("Unable to load video preview. Please check the video file or URL.")}
                  >
                    Your browser does not support the video tag.
                  </video>
                )}
              </div>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer style={{ borderTop: "1px solid #e9ecef", padding: "12px 24px" }}>
          <Button
            variant="outline-secondary"
            onClick={handleClose}
            style={{ borderRadius: "6px", fontSize: "0.9rem", padding: "6px 16px" }}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={!videoUrl.trim()}
            style={{
              borderRadius: "6px",
              fontSize: "0.9rem",
              padding: "6px 18px",
              fontWeight: "500",
              backgroundColor: "#4f46e5",
              borderColor: "#4f46e5"
            }}
          >
            Insert Video
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
};

export default InsertVideoModal;
