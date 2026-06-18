"use client";

import { useState } from "react";
import Image from "next/image";

import { getBlobImageUrl } from "@/lib/blob";

import styles from "./PhotoUploader.module.css";

/**
 * PhotoUploader - image uploader for business listings backed by Vercel Blob.
 *
 * Props:
 *   photos     {Array<{url, name}>}  current list of uploaded photos
 *   onChange   (photos) => void      called whenever the list changes
 *   maxPhotos  number                max photos allowed (from tier, default 1)
 */
export function PhotoUploader({ photos = [], onChange, maxPhotos = 1 }) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);

  const remainingSlots = Math.max(0, maxPhotos - photos.length);
  const canAddMore = remainingSlots > 0;

  function handleRemove(url) {
    onChange(photos.filter((photo) => photo.url !== url));
  }

  async function handleFileChange(event) {
    const selectedFiles = Array.from(event.target.files || []);
    event.target.value = "";

    if (selectedFiles.length === 0) {
      return;
    }

    const filesToUpload = selectedFiles.slice(0, remainingSlots);

    setUploading(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      filesToUpload.forEach((file) => formData.append("files", file));

      const response = await fetch("/api/business-photos/upload", {
        method: "POST",
        body: formData,
      });

      const payload = await response.json();

      if (!response.ok || !payload?.success) {
        throw new Error(payload?.message || "Upload failed. Please try again.");
      }

      const newPhotos = (payload.files || []).map((file) => ({
        url: file.url,
        name: file.name,
      }));

      onChange([...photos, ...newPhotos].slice(0, maxPhotos));
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className={styles.root}>
      {photos.length > 0 && (
        <div className={styles.grid}>
          {photos.map((photo, index) => (
            <div key={photo.url} className={styles.thumb}>
              <Image
                src={getBlobImageUrl(photo.url)}
                alt={photo.name || `Photo ${index + 1}`}
                fill
                sizes="160px"
                className={styles.thumbImg}
              />
              <button
                type="button"
                className={styles.removeBtn}
                onClick={() => handleRemove(photo.url)}
                aria-label="Remove photo"
              >
                x
              </button>
              {index === 0 ? <span className={styles.coverBadge}>Cover</span> : null}
            </div>
          ))}
        </div>
      )}

      <p className={styles.hint}>
        {photos.length} / {maxPhotos} photo{maxPhotos !== 1 ? "s" : ""} uploaded.
        {!canAddMore ? " Upgrade your plan to add more." : ""}
      </p>

      {canAddMore ? (
        <div className={styles.dropzoneWrap}>
          <label className={styles.uploadPanel}>
            <input
              type="file"
              accept="image/*"
              multiple={remainingSlots > 1}
              className={styles.fileInput}
              onChange={handleFileChange}
              disabled={uploading}
            />
            <span className={styles.uploadEyebrow}>Private Vercel Blob Upload</span>
            <span className={styles.uploadTitle}>
              {uploading ? "Uploading photos..." : "Choose photos to upload"}
            </span>
            <span className={styles.uploadMeta}>
              JPG, PNG, WEBP, and GIF supported. Up to 8MB per image.
            </span>
            <span className={styles.uploadButton}>
              {uploading ? "Uploading..." : remainingSlots > 1 ? "Select Photos" : "Select Photo"}
            </span>
          </label>
        </div>
      ) : null}

      {uploading ? <p className={styles.uploadingMsg}>Uploading...</p> : null}
      {uploadError ? <p className={styles.errorMsg}>{uploadError}</p> : null}
    </div>
  );
}
