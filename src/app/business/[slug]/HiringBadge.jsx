import { FaArrowDown, FaStar } from "react-icons/fa6";
import styles from "./page.module.css";

export default function HiringBadge() {
  return (
    <a href="#join-the-crew" className={styles.hiringBadge}>
      <FaStar aria-hidden="true" /> We’re hiring{" "}
      <FaArrowDown aria-hidden="true" />
    </a>
  );
}
