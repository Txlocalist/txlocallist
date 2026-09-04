"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import formStyles from "../../new/form.module.css";
import { updateBusinessAction } from "@/app/actions/businesses";
import { BusinessHoursEditor } from "../../BusinessHoursEditor";
import { createBusinessHoursFormState } from "@/lib/business-hours";

function parseHiringRoles(raw) {
  if (!raw) return [""];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [""];
    const roles = parsed.map((role) => role?.toString().trim()).filter(Boolean);
    return roles.length > 0 ? roles : [""];
  } catch {
    return [""];
  }
}

/**
 * Business edit form.
 * Similar to CreateBusinessForm but for existing listings.
 */
export function EditBusinessForm({ business, cities, tags }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: business.name || "",
    description: business.description || "",
    phone: business.phone || "",
    email: business.email || "",
    website: business.website || "",
    socialLinks: Object.fromEntries(["facebook", "instagram", "linkedin", "tiktok", "youtube", "x"].map((platform) => [platform, business.socialLinks?.find((link) => link.platform === platform)?.url || ""])),
    cityId: business.cityId || "",
    address: business.address || "",
    latitude: business.lat ?? "",
    longitude: business.lng ?? "",
    hours: createBusinessHoursFormState(business.hours),
    tagIds: business.tags?.map((bt) => bt.tagId) || [],
    newTags: "",
    isHiring: business.isHiring ?? false,
    hiringRoles: parseHiringRoles(business.hiringRoles),
  });

  // Handle input changes
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      ...(name === "isHiring" && checked && prev.hiringRoles.length === 0
        ? { hiringRoles: [""] }
        : {}),
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleTagToggle = (tagId) => {
    setFormData((prev) => ({
      ...prev,
      tagIds: prev.tagIds.includes(tagId)
        ? prev.tagIds.filter((id) => id !== tagId)
        : prev.tagIds.length < 5 ? [...prev.tagIds, tagId] : prev.tagIds,
    }));
  };
  const handleSocialChange = (platform, value) => setFormData((prev) => ({ ...prev, socialLinks: { ...prev.socialLinks, [platform]: value } }));

  const handleHiringRoleChange = (index, value) => {
    setFormData((prev) => ({
      ...prev,
      hiringRoles: prev.hiringRoles.map((role, i) => (i === index ? value : role)),
    }));
  };

  const addHiringRole = () => {
    setFormData((prev) => ({
      ...prev,
      hiringRoles: [...prev.hiringRoles, ""],
    }));
  };

  const removeHiringRole = (index) => {
    setFormData((prev) => ({
      ...prev,
      hiringRoles:
        prev.hiringRoles.length <= 1
          ? [""]
          : prev.hiringRoles.filter((_, i) => i !== index),
    }));
  };

  // Handle submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!formData.name.trim()) {
      setError("Business name is required");
      return;
    }
    if (!formData.description.trim()) {
      setError("Business description is required");
      return;
    }
    if (!formData.cityId) {
      setError("City is required");
      return;
    }
    if (formData.isHiring && !formData.hiringRoles.some((role) => role.trim().length > 0)) {
      setError("Add at least one hiring role when hiring is enabled");
      return;
    }

    setLoading(true);
    try {
      const result = await updateBusinessAction(business.id, {
        name: formData.name,
        description: formData.description,
        phone: formData.phone || null,
        email: formData.email || null,
        website: formData.website || null,
        socialLinks: formData.socialLinks,
        cityId: formData.cityId,
        address: formData.address,
        latitude: formData.latitude,
        longitude: formData.longitude,
        hours: formData.hours,
        tagIds: formData.tagIds,
        newTags: formData.newTags,
        isHiring: formData.isHiring,
        hiringRoles: formData.hiringRoles,
      });

      if (!result.success) {
        setError(result.message || "Failed to update listing");
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        router.push("/dashboard/businesses");
      }, 1500);
    } catch (err) {
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className={formStyles.form}>
      {error && <div className={formStyles.errorMessage}>{error}</div>}

      {success && (
        <div className={formStyles.successMessage}>
          Listing updated successfully. Redirecting...
        </div>
      )}

      <div className={formStyles.step}>
        <h2 className={formStyles.stepTitle}>Edit Listing</h2>
        <p className={formStyles.stepDescription}>
          Update your business information
        </p>

        <div className={formStyles.formGroup}>
          <label htmlFor="name" className={formStyles.label}>
            Business Name *
          </label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder="e.g., Coffee House Cafe"
            className={formStyles.input}
            required
          />
        </div>

        <div className={formStyles.formRow}>
          {Object.keys(formData.socialLinks).map((platform) => <div className={formStyles.formGroup} key={platform}><label htmlFor={`social-${platform}`} className={formStyles.label}>{platform === "x" ? "X / Twitter" : platform}</label><input id={`social-${platform}`} type="url" value={formData.socialLinks[platform]} onChange={(event) => handleSocialChange(platform, event.target.value)} placeholder={`https://${platform}.com/...`} className={formStyles.input} /></div>)}
        </div>

        <div className={formStyles.formGroup}>
          <label htmlFor="description" className={formStyles.label}>
            Description *
          </label>
          <textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleChange}
            placeholder="Describe your business..."
            rows={5}
            className={formStyles.textarea}
            required
          />
        </div>

        <div className={formStyles.formRow}>
          <div className={formStyles.formGroup}>
            <label htmlFor="phone" className={formStyles.label}>
              Phone
            </label>
            <input
              type="tel"
              id="phone"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              placeholder="(512) 555-0123"
              className={formStyles.input}
            />
          </div>

          <div className={formStyles.formGroup}>
            <label htmlFor="email" className={formStyles.label}>
              Email
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="hello@business.com"
              className={formStyles.input}
            />
          </div>
        </div>

        <div className={formStyles.formGroup}>
          <label htmlFor="website" className={formStyles.label}>
            Website
          </label>
          <input
            type="url"
            id="website"
            name="website"
            value={formData.website}
            onChange={handleChange}
            placeholder="https://example.com"
            className={formStyles.input}
          />
        </div>

        <h3 style={{ marginTop: "2rem" }}>Location</h3>

        <div className={formStyles.formGroup}>
          <label htmlFor="cityId" className={formStyles.label}>
            City *
          </label>
          <select
            id="cityId"
            name="cityId"
            value={formData.cityId}
            onChange={handleChange}
            className={formStyles.select}
            required
          >
            <option value="">Select a city...</option>
            {cities.map((city) => (
              <option key={city.id} value={city.id}>
                {city.name}
              </option>
            ))}
          </select>
        </div>

        <div className={formStyles.formGroup}>
          <label htmlFor="address" className={formStyles.label}>
            Street Address (optional)
          </label>
          <input
            type="text"
            id="address"
            name="address"
            value={formData.address}
            onChange={handleChange}
            placeholder="123 Main Street"
            className={formStyles.input}
          />
        </div>

        <div className={formStyles.formRow}>
          <div className={formStyles.formGroup}>
            <label htmlFor="latitude" className={formStyles.label}>
              Latitude (optional)
            </label>
            <input
              type="number"
              id="latitude"
              name="latitude"
              step="0.000001"
              value={formData.latitude}
              onChange={handleChange}
              placeholder="30.2672"
              className={formStyles.input}
            />
          </div>

          <div className={formStyles.formGroup}>
            <label htmlFor="longitude" className={formStyles.label}>
              Longitude (optional)
            </label>
            <input
              type="number"
              id="longitude"
              name="longitude"
              step="0.000001"
              value={formData.longitude}
              onChange={handleChange}
              placeholder="-97.7431"
              className={formStyles.input}
            />
          </div>
        </div>

        <BusinessHoursEditor
          hours={formData.hours}
          onChange={(hours) =>
            setFormData((prev) => ({
              ...prev,
              hours,
            }))
          }
        />

        <h3 style={{ marginTop: "2rem" }}>Tags</h3>

        <div className={formStyles.formGroup}>
          <label className={formStyles.label}>Tags (up to five, admin-approved)</label>
          {tags.length > 0 ? (
            <div className={formStyles.categoryGrid}>
              {tags.map((tag) => (
                <label key={tag.id} className={formStyles.categoryCheckbox}>
                  <input
                    type="checkbox"
                    checked={formData.tagIds.includes(tag.id)}
                    onChange={() => handleTagToggle(tag.id)}
                    disabled={!formData.tagIds.includes(tag.id) && formData.tagIds.length >= 5}
                  />
                  <span className={formStyles.categoryLabel}>{tag.name}</span>
                </label>
              ))}
            </div>
          ) : (
            <p className={formStyles.stepDescription}>
              No admin tags are available yet.
            </p>
          )}
        </div>

        <div className={formStyles.formGroup}><label htmlFor="newTags" className={formStyles.label}>Suggest new tags (optional)</label><input id="newTags" name="newTags" value={formData.newTags} onChange={handleChange} className={formStyles.input} placeholder="family-owned, dog-friendly" /><p className={formStyles.checkboxHint}>Separate tags with commas. Selected and suggested tags may total five.</p></div>

        <div className={formStyles.formGroup}>
          <label className={formStyles.checkboxLabel}>
            <input
              type="checkbox"
              name="isHiring"
              checked={formData.isHiring}
              onChange={handleChange}
            />
            <span>This business is currently hiring</span>
          </label>
          <p className={formStyles.checkboxHint}>
            Turn this on to show a hiring card on your public listing
          </p>
        </div>

        {formData.isHiring && (
          <div className={formStyles.formGroup}>
            <label className={formStyles.label}>Hiring Roles *</label>
            <div className={formStyles.roleList}>
              {formData.hiringRoles.map((role, index) => (
                <div key={index} className={formStyles.roleRow}>
                  <input
                    type="text"
                    value={role}
                    onChange={(e) => handleHiringRoleChange(index, e.target.value)}
                    placeholder="e.g., Server, Barista, Shift Manager"
                    className={formStyles.input}
                  />
                  {formData.hiringRoles.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeHiringRole(index)}
                      className={formStyles.roleRemoveButton}
                      aria-label="Remove role"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button type="button" onClick={addHiringRole} className={formStyles.roleAddButton}>
              + Add Role
            </button>
          </div>
        )}
      </div>

      <div className={formStyles.formNavigation}>
        <button
          type="button"
          onClick={() => router.back()}
          className={formStyles.buttonSecondary}
          disabled={loading}
        >
          Cancel
        </button>
        <button
          type="submit"
          className={formStyles.buttonPrimary}
          disabled={loading}
        >
          {loading ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </form>
  );
}
