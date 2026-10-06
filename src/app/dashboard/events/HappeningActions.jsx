import Link from "next/link";
import DeleteListingButton from "@/components/DeleteListingButton/DeleteListingButton";
import EventEditLink from "./EventEditLink";
import styles from "./events.module.css";

export default function HappeningActions({ event, hasCreatorAccess, children }) {
  const canView = event.status === "PUBLISHED" && (
    event.postingMethod === "ONE_TIME" || (hasCreatorAccess && (!event.business || event.business.status === "ACTIVE"))
  );

  return (
    <div className={styles.actions}>
      <EventEditLink event={event} hasCreatorAccess={hasCreatorAccess} label="Edit" className={styles.editAction} />
      {canView ? (
        <Link href={`/events/${event.id}`} className={styles.viewAction} target="_blank" rel="noopener noreferrer" aria-label={`View ${event.title} (opens in a new tab)`}>
          View
        </Link>
      ) : null}
      {children}
      <DeleteListingButton id={event.id} name={event.title} kind="event" className={styles.deleteAction} />
    </div>
  );
}
