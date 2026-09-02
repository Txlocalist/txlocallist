"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  confirmUserRoleChangeAction,
  previewUserRoleChangeAction,
} from "@/app/actions/admin";

import styles from "./users.module.css";

const ROLE_LABELS = {
  USER: "User",
  COMPLIMENTARY: "Complimentary",
  MANAGER: "Manager",
  ADMIN: "Admin",
};

function formatDate(value) {
  if (!value) return "Unknown renewal date";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "long" }).format(new Date(value));
}

function formatMoney(amountCents, currency = "usd") {
  if (!Number.isInteger(amountCents)) return "Recurring plan";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amountCents / 100);
}

export function UserRoleControl({
  userId,
  email,
  currentRole,
  complimentaryRoleMutationsEnabled = false,
  activeTransition = null,
}) {
  const router = useRouter();
  const dialogRef = useRef(null);
  const [selectedRole, setSelectedRole] = useState(currentRole);
  const [savedRole, setSavedRole] = useState(currentRole);
  const [preview, setPreview] = useState(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [message, setMessage] = useState("");
  const [recoverableTransition, setRecoverableTransition] = useState(activeTransition);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setRecoverableTransition(activeTransition);
  }, [activeTransition]);

  function prepareChange() {
    setMessage("");
    startTransition(async () => {
      const result = await previewUserRoleChangeAction({
        targetUserId: userId,
        toRole: selectedRole,
      });
      if (!result.ok) {
        setMessage(result.error);
        return;
      }
      setPreview(result.preview);
      setAcknowledged(false);
      dialogRef.current?.showModal();
    });
  }

  function closeDialog(force = false) {
    if (isPending && !force) return;
    dialogRef.current?.close();
    setPreview(null);
    setAcknowledged(false);
  }

  function handleCancel(event) {
    event.preventDefault();
    closeDialog();
  }

  function confirmChange() {
    if (!preview) return;
    setMessage("");
    startTransition(async () => {
      const result = await confirmUserRoleChangeAction({
        operationId: preview.id,
        confirmed: true,
      });
      if (!result.ok) {
        setMessage(result.error);
        router.refresh();
        return;
      }
      setSavedRole(preview.toRole);
      setSelectedRole(preview.toRole);
      setMessage(`Role changed to ${ROLE_LABELS[preview.toRole]}.`);
      setRecoverableTransition(null);
      closeDialog(true);
      router.refresh();
    });
  }

  function resumeChange() {
    if (!recoverableTransition) return;
    setMessage("");
    setSelectedRole(recoverableTransition.toRole);
    setPreview(recoverableTransition);
    setAcknowledged(false);
    dialogRef.current?.showModal();
  }

  const needsBillingAcknowledgement = preview?.toRole === "COMPLIMENTARY";

  return (
    <div className={styles.roleControl}>
      <label className={styles.srOnly} htmlFor={`role-${userId}`}>
        Role for {email}
      </label>
      <select
        id={`role-${userId}`}
        value={selectedRole}
        onChange={(event) => setSelectedRole(event.target.value)}
        className={styles.roleSelect}
        disabled={isPending}
      >
        <option value="USER">User</option>
        <option value="COMPLIMENTARY" disabled={!complimentaryRoleMutationsEnabled}>
          Complimentary{complimentaryRoleMutationsEnabled ? "" : " (assignment paused)"}
        </option>
        <option value="MANAGER">Manager</option>
        <option value="ADMIN">Admin</option>
      </select>
      <button
        type="button"
        className={styles.saveButton}
        disabled={isPending || selectedRole === savedRole}
        onClick={prepareChange}
      >
        {isPending ? "Working..." : "Review"}
      </button>
      {recoverableTransition ? (
        <div className={styles.recoveryPanel} role="status">
          <strong>
            Role change {recoverableTransition.status.toLowerCase().replaceAll("_", " ")}
          </strong>
          <span>
            {recoverableTransition.errorMessage ||
              "This saved operation must be completed before billing can change again."}
          </span>
          <button
            type="button"
            className={styles.recoveryButton}
            disabled={isPending}
            onClick={resumeChange}
          >
            Resume safely
          </button>
        </div>
      ) : null}
      {message ? (
        <p className={styles.inlineMessage} aria-live="polite">
          {message}
        </p>
      ) : null}

      <dialog
        ref={dialogRef}
        className={styles.roleDialog}
        aria-labelledby={`role-dialog-title-${userId}`}
        aria-describedby={`role-dialog-description-${userId}`}
        onCancel={handleCancel}
      >
        {preview ? (
          <div className={styles.dialogContent}>
            <div>
              <p className={styles.dialogEyebrow}>
                {recoverableTransition?.id === preview.id
                  ? "Resume saved role change"
                  : "Confirm role change"}
              </p>
              <h2 id={`role-dialog-title-${userId}`} className={styles.dialogTitle}>
                {ROLE_LABELS[preview.target.role]} to {ROLE_LABELS[preview.toRole]}
              </h2>
              <p
                id={`role-dialog-description-${userId}`}
                className={styles.dialogDescription}
              >
                This changes access for <strong>{preview.target.email}</strong> immediately after verification.
              </p>
            </div>

            {needsBillingAcknowledgement ? (
              <div className={styles.warningPanel}>
                <h3>Complimentary access replaces renewal</h3>
                <p>
                  Creator access starts immediately after every TX Localist renewal is scheduled to cancel. There is no automatic refund or proration.
                </p>
                {preview.subscriptions.length > 0 ? (
                  <ul className={styles.subscriptionList}>
                    {preview.subscriptions.map((subscription) => (
                      <li key={subscription.id}>
                        <span>
                          {formatMoney(subscription.amountCents, subscription.currency)} · {subscription.status.replaceAll("_", " ")}
                        </span>
                        <strong>
                          {subscription.cancelAtPeriodEnd
                            ? "Already scheduled"
                            : `Paid through ${formatDate(subscription.currentPeriodEnd)}`}
                        </strong>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className={styles.noSubscription}>No recurring subscription is linked to this account.</p>
                )}
                <label className={styles.confirmLabel}>
                  <input
                    type="checkbox"
                    checked={acknowledged}
                    onChange={(event) => setAcknowledged(event.target.checked)}
                  />
                  <span>
                    I understand that returning this account to User will not restart renewal.
                  </span>
                </label>
              </div>
            ) : (
              <p className={styles.standardNotice}>
                Manager and Admin roles receive staff creator access. Changing to User removes role-provided access but does not change Stripe renewal.
              </p>
            )}

            {message ? (
              <p className={styles.dialogError} role="alert">{message}</p>
            ) : null}

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
                className={styles.confirmButton}
                disabled={isPending || (needsBillingAcknowledgement && !acknowledged)}
                onClick={confirmChange}
              >
                {isPending
                  ? "Applying..."
                  : recoverableTransition?.id === preview.id
                    ? "Resume safely"
                    : `Change to ${ROLE_LABELS[preview.toRole]}`}
              </button>
            </div>
          </div>
        ) : null}
      </dialog>
    </div>
  );
}
