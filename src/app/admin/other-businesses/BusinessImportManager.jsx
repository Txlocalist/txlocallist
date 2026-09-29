"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./other-businesses.module.css";

const API_ROOT = "/api/admin/other-businesses";
const MAX_FILE_BYTES = 3 * 1024 * 1024;
const number = (value) => Number(value || 0).toLocaleString("en-US");
const businesses = (value) => `${number(value)} ${Number(value) === 1 ? "business" : "businesses"}`;

function importDate(value) {
  if (!value) return "No spreadsheet published yet";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Date unavailable" : new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium", timeStyle: "short", timeZone: "America/Chicago",
  }).format(date) + " CT";
}

async function responseData(response) {
  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error("The website returned an unexpected response. Please try again.");
  }
  if (!response.ok || !payload.success) {
    throw Object.assign(new Error(payload.error || "The request could not be completed. Please try again."), {
      status: response.status, issues: payload.issues,
    });
  }
  return payload.data;
}

function IssueList({ issues, count }) {
  if (!count && !issues?.length) return null;
  return <div className={styles.issuePanel} role="alert">
    <h3>Fix {number(count || issues.length)} {Number(count || issues.length) === 1 ? "issue" : "issues"} before publishing</h3>
    <ul>{issues.map((issue, index) => <li key={`${issue.row}-${issue.field}-${index}`}>
      {issue.row ? <strong>Row {issue.row}{issue.field ? `, ${issue.field}` : ""}: </strong> : null}
      {issue.message}
    </li>)}</ul>
    {count > issues.length ? <p>Showing the first {number(issues.length)} issues. Correct the spreadsheet and preview it again to check all rows.</p> : null}
  </div>;
}

export default function BusinessImportManager({ initialState, taxonomy }) {
  const router = useRouter();
  const fileInput = useRef(null);
  const busy = useRef(false);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [publishedState, setPublishedState] = useState(null);
  const [pending, setPending] = useState("");
  const [error, setError] = useState("");
  const [issues, setIssues] = useState([]);
  const [message, setMessage] = useState("");
  const [downloading, setDownloading] = useState("");
  const current = publishedState && publishedState.revision >= initialState.revision ? publishedState : initialState;
  const importer = typeof current.lastImportedBy === "string"
    ? current.lastImportedBy
    : current.lastImportedBy?.name || current.lastImportedBy?.email || "";

  function chooseFile(event) {
    const selected = event.target.files?.[0] || null;
    setPreview(null);
    setIssues([]);
    setMessage("");
    setError("");
    setFile(selected);
    if (selected && !/\.(xlsx|csv)$/i.test(selected.name)) setError("Choose an Excel (.xlsx) or CSV file.");
    else if (selected?.size > MAX_FILE_BYTES) setError("Choose a spreadsheet that is 3 MB or smaller.");
    else if (selected && !selected.size) setError("The selected file is empty.");
  }

  async function previewFile(event) {
    event.preventDefault();
    if (busy.current || !file) return;
    busy.current = true;
    setPending("preview");
    setPreview(null);
    setError("");
    setIssues([]);
    setMessage("");
    try {
      const form = new FormData();
      form.set("file", file);
      const response = await fetch(`${API_ROOT}/preview`, { method: "POST", body: form, signal: AbortSignal.timeout(65000) });
      const result = await responseData(response);
      setPreview(result);
      if (result.canPublish) setMessage("Spreadsheet checked. Review the changes below, then publish your list.");
    } catch (failure) {
      setError(failure instanceof TypeError ? "We couldn’t connect to the website. Check your connection and preview the file again." : failure.message);
      setIssues(failure.issues || []);
    } finally {
      busy.current = false;
      setPending("");
    }
  }

  async function publishFile() {
    if (busy.current || !file || !preview?.canPublish) return;
    busy.current = true;
    setPending("publish");
    setError("");
    setIssues([]);
    setMessage("");
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("fileHash", preview.fileHash);
      form.set("revision", String(preview.revision));
      form.set("taxonomyDigest", preview.taxonomyDigest);
      const response = await fetch(`${API_ROOT}/publish`, { method: "POST", body: form, signal: AbortSignal.timeout(65000) });
      const result = await responseData(response);
      setPublishedState(result);
      setPreview(null);
      setFile(null);
      if (fileInput.current) fileInput.current.value = "";
      setMessage(`Your list is published. The current spreadsheet contains ${businesses(result.total)}.`);
      router.refresh();
    } catch (failure) {
      // A connection can fail after the server commits. Require a fresh preview
      // instead of retrying a potentially completed replacement blindly.
      setPreview(null);
      setIssues(failure.issues || []);
      setError(failure instanceof TypeError || failure.name === "TimeoutError"
        ? "We couldn’t confirm whether publication completed. Check the latest import below, then preview your file again before retrying."
        : `${failure.message} Preview your spreadsheet again before publishing.`);
      router.refresh();
    } finally {
      busy.current = false;
      setPending("");
    }
  }

  async function downloadSpreadsheet(type, format) {
    if (downloading) return;
    setDownloading(`${type}-${format}`);
    setError("");
    try {
      const response = await fetch(`${API_ROOT}/${type}?format=${format}`, { cache: "no-store", signal: AbortSignal.timeout(65000) });
      if (!response.ok) await responseData(response);
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = `tx-localist-import-businesses-${type === "export" ? "current" : "template"}.${format}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (failure) {
      setError(failure instanceof TypeError ? "The download couldn’t connect. Check your connection and try again." : failure.message);
    } finally {
      setDownloading("");
    }
  }

  const downloadButtons = (type) => <div className={styles.actions}>
    {["xlsx", "csv"].map((format) => <button key={format} type="button" className={styles.button}
      disabled={Boolean(downloading)} onClick={() => downloadSpreadsheet(type, format)}>
      {downloading === `${type}-${format}` ? "Preparing…" : `${type === "export" ? "Export" : "Download"} ${format === "xlsx" ? "Excel" : "CSV"}`}
    </button>)}
  </div>;

  return <div className={styles.manager} aria-busy={Boolean(pending)}>
    <section className={styles.statusCard} aria-labelledby="current-list-title">
      <div>
        <p className={styles.eyebrow}>Current master list</p>
        <h2 id="current-list-title">{businesses(current.total)}</h2>
        <p>Last published: {importDate(current.lastImportedAt)}{importer ? ` by ${importer}` : ""}</p>
        {current.lastFileName ? <p className={styles.fileName}>{current.lastFileName}</p> : null}
      </div>
      <div className={styles.exportGroup}>
        {downloadButtons("export")}
        <p>Exports include businesses currently hidden because they have a subscribed listing.</p>
      </div>
    </section>

    <section className={styles.card} aria-labelledby="prepare-list-title">
      <div className={styles.sectionHeading}><span className={styles.step} aria-hidden="true">1</span><h2 id="prepare-list-title">Prepare your spreadsheet</h2></div>
      <p>Start with a template or export the current list. Keep the three columns <strong>Name</strong>, <strong>City</strong>, and <strong>Category</strong>, with one business and one category per row. Save this as your master spreadsheet and reuse it for every upload.</p>
      {downloadButtons("template")}
      <p>Use the city and business category names below. Excel templates include dropdowns. Add any new cities or categories in the admin panel before uploading.</p>
      <details className={styles.taxonomy}>
        <summary>View available cities and business categories</summary>
        <div className={styles.taxonomyColumns}>
          <div><h3>Cities</h3><ul>{taxonomy.cities.map((city) => <li key={city.id}>{city.name}</li>)}</ul><Link href="/admin/cities">Manage cities</Link></div>
          <div><h3>Business categories</h3><ul>{taxonomy.categories.map((category) => <li key={category.id}>{category.name}</li>)}</ul><Link href="/admin/categories/business">Manage business categories</Link></div>
        </div>
      </details>
    </section>

    <section className={styles.card} aria-labelledby="upload-list-title">
      <div className={styles.sectionHeading}><span className={styles.step} aria-hidden="true">2</span><h2 id="upload-list-title">Upload your complete list</h2></div>
      <div className={styles.replacementNotice}><strong>Each upload replaces the entire “Other businesses” list.</strong><p>Include every business you want to keep, across all cities. Businesses left out of the file will be removed from this section. Subscribed listings are kept separately.</p></div>
      <form onSubmit={previewFile} className={styles.uploadForm}>
        <label htmlFor="business-spreadsheet">Business spreadsheet</label>
        <input id="business-spreadsheet" ref={fileInput} name="file" type="file" accept=".xlsx,.csv" onChange={chooseFile}
          disabled={Boolean(pending)} required aria-describedby="business-file-help" />
        <p id="business-file-help">Excel (.xlsx) or CSV · up to 10,000 businesses · 3 MB maximum. Empty lists cannot be published.</p>
        <button type="submit" className={`${styles.button} ${styles.primary}`} disabled={Boolean(pending) || !file || file.size === 0 || file.size > MAX_FILE_BYTES || !/\.(xlsx|csv)$/i.test(file.name)}>
          {pending === "preview" ? "Checking spreadsheet…" : "Preview changes"}
        </button>
      </form>
    </section>

    {error ? <p role="alert" className={styles.error}>{error}</p> : null}
    <IssueList issues={issues} count={issues.length} />
    {message ? <p role="status" className={styles.success}>{message}</p> : null}

    {preview ? <section className={styles.card} aria-labelledby="review-list-title">
      <div className={styles.sectionHeading}><span className={styles.step} aria-hidden="true">3</span><h2 id="review-list-title">Review your changes</h2></div>
      <dl className={styles.counts}>{[
        ["In spreadsheet", preview.summary.total], ["Added", preview.summary.added], ["Changed", preview.summary.changed],
        ["Removed", preview.summary.removed], ["Unchanged", preview.summary.unchanged], ["Already listed", preview.summary.hidden],
      ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{number(value)}</dd></div>)}</dl>
      <p>“Already listed” businesses stay in your spreadsheet and are hidden from “Other businesses” while a matching subscribed listing is public.</p>
      <IssueList issues={preview.issues || []} count={preview.issueCount} />
      {preview.rows.length ? <div className={styles.tableWrap} tabIndex={0} role="region" aria-label="Spreadsheet preview">
        <table className={styles.table}>
          <caption>{preview.rows.length < preview.summary.total ? `First ${number(preview.rows.length)} of ${number(preview.summary.total)} businesses` : `${number(preview.rows.length)} businesses in this spreadsheet`}</caption>
          <thead><tr><th scope="col">Name</th><th scope="col">City</th><th scope="col">Category</th></tr></thead>
          <tbody>{preview.rows.map((row, index) => <tr key={`${row.name}-${row.city}-${index}`}><td>{row.name}</td><td>{row.city}</td><td>{row.category}</td></tr>)}</tbody>
        </table>
      </div> : null}
      {preview.canPublish ? <div className={styles.publishPanel}>
        <p>Publishing will replace the current list with <strong>{businesses(preview.summary.total)}</strong>{preview.summary.removed ? ` and remove ${businesses(preview.summary.removed)} missing from this spreadsheet` : ""}.</p>
        <button type="button" className={`${styles.button} ${styles.primary}`} disabled={Boolean(pending)} onClick={publishFile}>
          {pending === "publish" ? "Publishing list…" : "Publish replacement list"}
        </button>
      </div> : null}
    </section> : null}
  </div>;
}
