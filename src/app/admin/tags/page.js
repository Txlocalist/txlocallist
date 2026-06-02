import { AdminShell } from "../AdminShell";
import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { deleteTagAction } from "@/app/actions/admin";
import { TagCreateForm } from "../TagCreateForm";
import styles from "@/app/dashboard/dashboard.module.css";

export default async function AdminTagsPage() {
  await requireAdmin();

  const tags = await prisma.tag.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { businessTags: true } } },
  });

  return (
    <AdminShell activeTab="tags">
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Directory Tags</h1>
          <p className={styles.pageSubtitle}>{tags.length} tags - used to categorize listings and events</p>
        </div>
      </div>

      <div className={styles.card} style={{ marginBottom: "2rem" }}>
        <h2 style={{ fontFamily: "var(--font-display), cursive", color: "var(--retro-brown)", marginTop: 0 }}>Create New Tag</h2>
        <TagCreateForm />
      </div>

      <div className={styles.businessesTable}>
        <div className={styles.tableHeader}>
          <div className={styles.tableCol} style={{ flex: 2 }}>Name</div>
          <div className={styles.tableCol} style={{ flex: 2 }}>Slug</div>
          <div className={styles.tableCol} style={{ flex: 1 }}>Businesses</div>
          <div className={styles.tableCol} style={{ flex: 1 }}>Actions</div>
        </div>
        <div className={styles.tableBody}>
          {tags.map((tag) => (
            <div key={tag.id} className={styles.tableRow}>
              <div className={styles.tableCol} style={{ flex: 2 }}>
                <p className={styles.businessName}>{tag.name}</p>
              </div>
              <div className={styles.tableCol} style={{ flex: 2 }}>
                <p className={styles.businessMeta}>{tag.slug}</p>
              </div>
              <div className={styles.tableCol} style={{ flex: 1 }}>
                {tag._count.businessTags}
              </div>
              <div className={styles.tableCol} style={{ flex: 1 }}>
                <form action={deleteTagAction}>
                  <input type="hidden" name="id" value={tag.id} />
                  <button type="submit" className={styles.deleteButton}>Delete</button>
                </form>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AdminShell>
  );
}
