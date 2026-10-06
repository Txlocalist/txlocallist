import Link from "next/link";
import { FaRegPenToSquare } from "react-icons/fa6";

export function canEditHappening(event, hasCreatorAccess) {
  return (event.postingMethod === "ONE_TIME" || hasCreatorAccess)
    && !["CANCELLED", "DENIED"].includes(event.status);
}

export default function EventEditLink({ event, hasCreatorAccess, className, label = "Edit happening" }) {
  if (!canEditHappening(event, hasCreatorAccess)) return null;

  return (
    <Link
      href={`/dashboard/events/${event.id}/edit`}
      className={className}
      aria-label={`Edit ${event.title}`}
    >
      <FaRegPenToSquare aria-hidden="true" />
      {label}
    </Link>
  );
}
