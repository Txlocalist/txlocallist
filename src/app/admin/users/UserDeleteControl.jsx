"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  deleteUserAccountAction,
  previewUserDeletionAction,
} from "@/app/actions/admin";

import styles from "./users.module.css";

function impactLabel(value, singular, plural = `${singular}s`) {
  return `${value} ${value === 1 ? singular : plural}`;
}

export function UserDeleteControl({ userId, email, isCurrentUser }) {
  const router = useRouter();
  const triggerRef = useRef(null);
  const dialogRef = useRef(null);
  const [preview, setPreview] = useState(null);
  const [confirmationEmail, setConfirmationEmail] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  function reviewDeletion() {
    setMessage("");
    startTransition(async () => {
      const result = await previewUserDeletionAction({ targetUserId: userId });
      if (!result.ok) {
        setMessage(result.error);
        return;
      }
      setPreview(result.preview);
      setConfirmationEmail("");
      setAcknowledged(false);
      dialogRef.current?.showModal();
    });
  }

  function closeDialog({ restoreFocus = true } = {}) {
    if (isPending) return;
    dialogRef.current?.close();
    setPreview(null);
    setConfirmationEmail("");
    setAcknowledged(false);
    setMessage("");
    if (restoreFocus) requestAnimationFrame(() => triggerRef.current?.focus());
  }

  function handleCancel(event) {
    event.preventDefault();
    closeDialog();
  }

  function confirmDeletion() {
    if (!preview?.canDelete) return;
    setMessage("");
    startTransition(async () => {
      const result = await deleteUserAccountAction({
        targetUserId: userId,
        expectedRoleVersion: preview.target.roleVersion,
        confirmationEmail,
        confirmed: acknowledged,
      });
      if (!result.ok) {
        setMessage(result.error);
        return;
      }
      dialogRef.current?.close();
      setPreview(null);
      router.refresh();
    });
  }

  const emailMatches =
    preview &&
    confirmationEmail.trim().toLowerCase() === preview.target.email.toLowerCase();
  const canConfirm =
    preview?.canDelete && acknowledged && emailMatches && !isPending;

  return (
    <div className={styles.deleteControl}>
      <button
        ref={triggerRef}
        type="button"
        className={styles.deleteButton}
        aria-label={`Delete account ${email}`}
        disabled={isPending || isCurrentUser}
        aria-describedby={isCurrentUser ? `delete-current-${userId}` : undefined}
        onClick={reviewDeletion}
      >
        {isPending && !preview ? "Checking..." : "Delete account"}
      </button>
      {isCurrentUser ? (
        <span id={`delete-current-${userId}`} className={styles.controlHint}>
          You cannot delete your current account.
        </span>
      ) : null}
      {!preview && message ? (
        <p className={styles.inlineMessage} role="alert">
          {message}
        </p>
      ) : null}

      <dialog
        ref={dialogRef}
        className={styles.roleDialog}
        aria-labelledby={`delete-dialog-title-${userId}`}
        aria-describedby={`delete-dialog-description-${userId}`}
        onCancel={handleCancel}
      >
        {preview ? (
          <div className={styles.dialogContent}>
            <div>
              <p className={styles.deleteEyebrow}>Permanent account deletion</p>
              <h2 id={`delete-dialog-title-${userId}`} className={styles.dialogTitle}>
                Delete {preview.target.email}?
              </h2>
              <p
                id={`delete-dialog-description-${userId}`}
                className={styles.dialogDescription}
              >
                This removes sign-in access and personal profile details immediately. The account cannot be restored through the Admin panel.
              </p>
            </div>

            <div className={styles.deletionImpact}>
              <h3>What will happen</h3>
              <ul>
                <li>{impactLabel(preview.impact.businessesArchived, "business listing")} archived</li>
                <li>{impactLabel(preview.impact.eventsCancelled, "event")} cancelled</li>
                <li>{impactLabel(preview.impact.sessionsRemoved, "session")} removed</li>
                <li>{impactLabel(preview.impact.savedItemsRemoved, "saved item")} removed</li>
              </ul>
              <p>
                Required payment and audit history is retained under a deleted-account record
                {preview.impact.billingRecordsRetained > 0
                  ? `, including ${impactLabel(preview.impact.billingRecordsRetained, "payment record")}`
                  : ""}
                .
              </p>
            </div>

            {preview.blockers.length > 0 ? (
              <div className={styles.blockerPanel} role="alert">
                <h3>Deletion is currently blocked</h3>
                <ul>
                  {preview.blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}
                </ul>
              </div>
            ) : (
              <div className={styles.deletionConfirmation}>
                <label htmlFor={`delete-email-${userId}`}>
                  Type <strong>{preview.target.email}</strong> to confirm
                </label>
                <input
                  id={`delete-email-${userId}`}
                  type="email"
                  value={confirmationEmail}
                  autoComplete="off"
                  spellCheck="false"
                  disabled={isPending}
                  aria-invalid={confirmationEmail.length > 0 && !emailMatches}
                  onChange={(event) => setConfirmationEmail(event.target.value)}
                />
                <label className={styles.confirmLabel}>
                  <input
                    type="checkbox"
                    checked={acknowledged}
                    disabled={isPending}
                    onChange={(event) => setAcknowledged(event.target.checked)}
                  />
                  <span>I understand this action permanently removes access and public content.</span>
                </label>
              </div>
            )}

            {message ? <p className={styles.dialogError} role="alert">{message}</p> : null}

            <div className={styles.dialogActions}>
              <button
                type="button"
                className={styles.cancelButton}
                disabled={isPending}
                autoFocus
                onClick={() => closeDialog()}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.destructiveButton}
                disabled={!canConfirm}
                onClick={confirmDeletion}
              >
                {isPending ? "Deleting..." : "Permanently delete"}
              </button>
            </div>
          </div>
        ) : null}
      </dialog>
    </div>
  );
}
