"use client";

export default function CancelEventButton({ className }) {
  function confirmCancellation(event) {
    const confirmed = window.confirm(
      "Cancel this event? It will be removed from the public calendar, and organizer cancellations do not trigger an automatic refund.",
    );

    if (!confirmed) event.preventDefault();
  }

  return (
    <button type="submit" className={className} onClick={confirmCancellation}>
      Cancel
    </button>
  );
}
