"use client";

import { useState } from "react";
import Image from "next/image";

import { getBlobImageUrl } from "@/lib/blob";
import { MAX_BUSINESS_PHOTOS } from "@/lib/business-photos.mjs";

import styles from "./PhotoUploader.module.css";

/**
 * PhotoUploader - image uploader for business listings backed by Vercel Blob.
 *
 * Props:
 *   photos     {Array<{url, name}>}  current list of uploaded photos
 *   onChange   (photos) => void      called whenever the list changes
 *   maxPhotos  number                max photos allowed (default 3 for businesses)
 */
export function PhotoUploader({
  photos = [],
  onChange,
  maxPhotos = MAX_BUSINESS_PHOTOS,
  uploadEndpoint = "/api/business-photos/upload",
  acceptedTypes = "image/*",
  supportedTypesLabel = "JPG, PNG, WEBP, and GIF",
  limitMessage = "Remove a photo to add a different one.",
}) {
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

      const response = await fetch(uploadEndpoint, {
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
                disabled={uploading}
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
        {!canAddMore && limitMessage ? ` ${limitMessage}` : ""}
      </p>

      {canAddMore ? (
        <div className={styles.dropzoneWrap}>
          <label className={styles.uploadPanel}>
            <input
              type="file"
              accept={acceptedTypes}
              multiple={remainingSlots > 1}
              className={styles.fileInput}
              onChange={handleFileChange}
              disabled={uploading}
            />
            <span className={styles.uploadEyebrow}>Photo upload</span>
            <span className={styles.uploadTitle}>
              {uploading ? "Uploading photos..." : "Choose photos to upload"}
            </span>
            <span className={styles.uploadMeta}>
              {supportedTypesLabel} supported. Up to 8MB per image.
            </span>
            <span className={styles.uploadButton}>
              {uploading ? "Uploading..." : remainingSlots > 1 ? "Select Photos" : "Select Photo"}
            </span>
          </label>
        </div>
      ) : null}

      {uploading ? <p className={styles.uploadingMsg} role="status">Uploading...</p> : null}
      {uploadError ? <p className={styles.errorMsg} role="alert">{uploadError}</p> : null}
    </div>
  );
}
