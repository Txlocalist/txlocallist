"use client";

import { useState, useRef, useEffect } from "react";
import {
  FaArrowLeft,
  FaArrowRight,
  FaExpand,
  FaImages,
  FaXmark,
} from "react-icons/fa6";
import { getBlobImageUrl } from "@/lib/blob";
import styles from "./PhotoGallery.module.css";

export default function PhotoGallery({ photos = [], businessName }) {
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const dialogRef = useRef(null);
  const triggerRef = useRef(null);
  const isOpen = lightboxIndex !== null;
  const photo = photos[lightboxIndex];

  useEffect(() => {
    if (!isOpen) return;
    const dialog = dialogRef.current;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      triggerRef.current?.focus({ preventScroll: true });
    };
  }, [isOpen]);

  function openPhoto(index, event) {
    triggerRef.current = event.currentTarget;
    setLightboxIndex(index);
  }
  function movePhoto(direction) {
    setLightboxIndex(
      (index) => (index + direction + photos.length) % photos.length,
    );
  }
  function closePhoto() {
    setLightboxIndex(null);
  }

  if (!photos.length) return null;

  return (
    <>
      <div className={styles.galleryHeader}>
        <h2 className={styles.galleryTitle}>Take a look around</h2>
        <button
          type="button"
          className={styles.viewPhotos}
          onClick={(event) => openPhoto(0, event)}
        >
          <FaImages aria-hidden="true" /> View{" "}
          {photos.length === 1 ? "photo" : `all ${photos.length} photos`}
        </button>
      </div>
      <div
        className={styles.galleryGrid}
        data-count={Math.min(photos.length, 3)}
      >
        {photos.map((photo, index) => (
          <button
            type="button"
            key={photo.id || photo.url}
            className={styles.galleryItem}
            onClick={(event) => openPhoto(index, event)}
            aria-label={`View photo ${index + 1} of ${businessName}`}
          >
            <img
              src={getBlobImageUrl(photo.url)}
              alt={photo.alt || `${businessName}, photo ${index + 1}`}
              className={styles.galleryImg}
              loading="lazy"
              decoding="async"
            />
            <span className={styles.expandIcon} aria-hidden="true">
              <FaExpand />
            </span>
          </button>
        ))}
      </div>

      <dialog
        ref={dialogRef}
        className={styles.lightbox}
        aria-label={`${businessName} photo gallery`}
        onCancel={(event) => {
          event.preventDefault();
          closePhoto();
        }}
        onClose={closePhoto}
        onClick={(event) => {
          if (event.target === event.currentTarget) closePhoto();
        }}
        onKeyDown={(event) => {
          if (event.key === "Tab") {
            const buttons = event.currentTarget.querySelectorAll(
              "button:not(:disabled)",
            );
            const first = buttons[0];
            const last = buttons[buttons.length - 1];
            if (event.shiftKey && document.activeElement === first) {
              event.preventDefault();
              last?.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
              event.preventDefault();
              first?.focus();
            }
          }
          if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
            event.preventDefault();
            movePhoto(event.key === "ArrowLeft" ? -1 : 1);
          }
        }}
      >
        {photo ? (
          <div className={styles.lightboxContent}>
            <div className={styles.lightboxHeader}>
              <div>
                <p>{businessName}</p>
                <span aria-live="polite">
                  Photo {lightboxIndex + 1} of {photos.length}
                </span>
              </div>
              <button
                type="button"
                className={styles.iconButton}
                onClick={closePhoto}
                aria-label="Close gallery"
                autoFocus
              >
                <FaXmark aria-hidden="true" />
              </button>
            </div>
            <div className={styles.lightboxStage}>
              <img
                src={getBlobImageUrl(photo.url)}
                alt={photo.alt || `${businessName}, photo ${lightboxIndex + 1}`}
                className={styles.lightboxImg}
              />
            </div>
            <div className={styles.lightboxFooter}>
              {photos.length > 1 ? (
                <>
                  <button
                    type="button"
                    className={styles.iconButton}
                    onClick={() => movePhoto(-1)}
                    aria-label="Previous photo"
                  >
                    <FaArrowLeft aria-hidden="true" />
                  </button>
                  <div
                    className={styles.thumbnails}
                    aria-label="Choose a photo"
                  >
                    {photos.map((item, index) => (
                      <button
                        type="button"
                        key={item.id || item.url}
                        className={styles.thumbnail}
                        onClick={() => setLightboxIndex(index)}
                        aria-label={`Show photo ${index + 1}`}
                        aria-pressed={index === lightboxIndex}
                      >
                        <img src={getBlobImageUrl(item.url)} alt="" />
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    className={styles.iconButton}
                    onClick={() => movePhoto(1)}
                    aria-label="Next photo"
                  >
                    <FaArrowRight aria-hidden="true" />
                  </button>
                </>
              ) : null}
            </div>
          </div>
        ) : null}
      </dialog>
    </>
  );
}
