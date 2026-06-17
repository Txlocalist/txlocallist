"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import formStyles from "./form.module.css";
import { createBusinessFromFormAction, publishBusinessAction } from "@/app/actions/businesses";
import { BusinessHoursEditor } from "../BusinessHoursEditor";
import { PhotoUploader } from "@/components/PhotoUploader";
import { createBusinessHoursFormState, getBusinessHoursDisplayRows } from "@/lib/business-hours";

/**
 * Multi-step business creation form.
 * Steps: Basic Info -> Location -> Tags -> Photos -> Review
 */
export function CreateBusinessForm({ cities, tags }) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    // Step 1: Basic Info
    name: "",
    description: "",
    phone: "",
    email: "",
    website: "",
    
    // Step 2: Location
    cityId: "",
    address: "",
    latitude: "",
    longitude: "",
    hours: createBusinessHoursFormState(),
    
    // Step 3: Tags
    tagIds: [],
    isHiring: false,
    hiringRoles: [""],
    
    // Step 4: Photos (placeholder)
    photos: [],
    
    // Step 5: Review
    publish: false,
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
        : [...prev.tagIds, tagId],
    }));
  };

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

  // Validate current step
  const validateStep = () => {
    if (step === 1) {
      if (!formData.name.trim()) {
        setError("Business name is required");
        return false;
      }
      if (!formData.description.trim()) {
        setError("Business description is required");
        return false;
      }
    }
    if (step === 2) {
      if (!formData.cityId) {
        setError("City is required");
        return false;
      }
      if (!formData.address.trim()) {
        setError("Address is required");
        return false;
      }
    }
    if (step === 3 && formData.isHiring) {
      const hasAtLeastOneRole = formData.hiringRoles.some((role) => role.trim().length > 0);
      if (!hasAtLeastOneRole) {
        setError("Add at least one hiring role when hiring is enabled");
        return false;
      }
    }
    setError(null);
    return true;
  };

  // Handle next step
  const handleNext = () => {
    if (validateStep()) {
      setStep(step + 1);
    }
  };

  // Handle previous step
  const handlePrev = () => {
    setError(null);
    setStep(step - 1);
  };

  // Handle submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateStep()) return;

    setLoading(true);
    try {
      // Create draft business
      const result = await createBusinessFromFormAction({
        name: formData.name,
        description: formData.description,
        phone: formData.phone || null,
        email: formData.email || null,
        website: formData.website || null,
        cityId: formData.cityId,
        address: formData.address,
        latitude: formData.latitude ? parseFloat(formData.latitude) : null,
        longitude: formData.longitude ? parseFloat(formData.longitude) : null,
        hours: formData.hours,
        tagIds: formData.tagIds,
        isHiring: formData.isHiring,
        hiringRoles: formData.hiringRoles,
        photos: formData.photos,
      });

      if (!result.success) {
        setError(result.message || "Failed to create listing");
        setLoading(false);
        return;
      }

      const businessId = result.data.id;

      // Submit for review if user selected
      if (formData.publish) {
        const publishResult = await publishBusinessAction(businessId);
        if (!publishResult.success) {
          setError(publishResult.message || "Failed to submit listing for review");
          setLoading(false);
          return;
        }

        router.push("/dashboard/businesses?submitted=1");
        return;
      }

      // Redirect to businesses list
      router.push("/dashboard/businesses?created=1");
    } catch (err) {
      setError(err.message || "An error occurred");
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className={formStyles.form}>
      {/* Progress Indicator */}
      <div className={formStyles.progressBar}>
        {[1, 2, 3, 4, 5].map((s) => (
          <div
            key={s}
            className={`${formStyles.progressStep} ${
              s <= step ? formStyles.progressStepActive : ""
            } ${s === step ? formStyles.progressStepCurrent : ""}`}
          >
            <span>{s}</span>
          </div>
        ))}
      </div>

      {error && <div className={formStyles.errorMessage}>{error}</div>}

      {/* Step 1: Basic Info */}
      {step === 1 && (
        <div className={formStyles.step}>
          <h2 className={formStyles.stepTitle}>Basic Information</h2>
          <p className={formStyles.stepDescription}>
            Tell us about your business
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
        </div>
      )}

      {/* Step 2: Location */}
      {step === 2 && (
        <div className={formStyles.step}>
          <h2 className={formStyles.stepTitle}>Business Location</h2>
          <p className={formStyles.stepDescription}>
            Where is your business located?
          </p>

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
              Street Address *
            </label>
            <input
              type="text"
              id="address"
              name="address"
              value={formData.address}
              onChange={handleChange}
              placeholder="123 Main Street"
              className={formStyles.input}
              required
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
        </div>
      )}

      {/* Step 3: Tags */}
      {step === 3 && (
        <div className={formStyles.step}>
          <h2 className={formStyles.stepTitle}>Tags</h2>
          <p className={formStyles.stepDescription}>
            Choose any admin-managed tags that fit your business
          </p>

          <div className={formStyles.formGroup}>
            <label className={formStyles.label}>Tags (admin-managed, optional)</label>
            {tags.length > 0 ? (
              <div className={formStyles.categoryGrid}>
                {tags.map((tag) => (
                  <label key={tag.id} className={formStyles.categoryCheckbox}>
                    <input
                      type="checkbox"
                      checked={formData.tagIds.includes(tag.id)}
                      onChange={() => handleTagToggle(tag.id)}
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
      )}

      {/* Step 4: Photos */}
      {step === 4 && (
        <div className={formStyles.step}>
          <h2 className={formStyles.stepTitle}>Photos</h2>
          <p className={formStyles.stepDescription}>
            Add photos to make your listing stand out. Your first photo becomes the cover image.
            Paid accounts can upload up to 20 photos per listing.
          </p>
          <PhotoUploader
            photos={formData.photos}
            onChange={(photos) =>
              setFormData((prev) => ({ ...prev, photos }))
            }
            maxPhotos={20}
          />
        </div>
      )}

      {/* Step 5: Review & Submit */}
      {step === 5 && (
        <div className={formStyles.step}>
          <h2 className={formStyles.stepTitle}>Review & Submit</h2>
          <p className={formStyles.stepDescription}>
            Review your listing before saving or sending it to admin review
          </p>

          <div className={formStyles.reviewCard}>
            <h3>Business Information</h3>
            <p>
              <strong>{formData.name}</strong>
            </p>
            <p>{formData.description}</p>
            {formData.phone && <p>📞 {formData.phone}</p>}
            {formData.email && <p>📧 {formData.email}</p>}
            {formData.website && <p>🔗 {formData.website}</p>}
          </div>

          <div className={formStyles.reviewCard}>
            <h3>Location</h3>
            <p>
              {cities.find((c) => c.id === formData.cityId)?.name}
            </p>
            <p>{formData.address}</p>
          </div>

          <div className={formStyles.reviewCard}>
            <h3>Tags</h3>
            <p>
              {formData.tagIds.length > 0
                ? formData.tagIds
                    .map((id) => tags.find((tag) => tag.id === id)?.name)
                    .filter(Boolean)
                    .join(", ")
                : "No tags selected"}
            </p>
          </div>

          <div className={formStyles.reviewCard}>
            <h3>Hiring</h3>
            <p>{formData.isHiring ? "Currently hiring" : "Not hiring right now"}</p>
            {formData.isHiring && (
              <p>
                Roles:{" "}
                {formData.hiringRoles
                  .map((role) => role.trim())
                  .filter(Boolean)
                  .join(", ")}
              </p>
            )}
          </div>

          <div className={formStyles.reviewCard}>
            <h3>Hours</h3>
            {getBusinessHoursDisplayRows(formData.hours).map((day) => (
              <p key={day.dayOfWeek}>
                <strong>{day.shortLabel}:</strong> {day.value}
              </p>
            ))}
          </div>

          <div className={formStyles.formGroup}>
            <label className={formStyles.checkboxLabel}>
              <input
                type="checkbox"
                name="publish"
                checked={formData.publish}
                onChange={handleChange}
              />
              <span>Submit this listing for admin review</span>
            </label>
            <p className={formStyles.checkboxHint}>
              Leave this unchecked to save a draft and submit it later from your dashboard.
            </p>
          </div>
        </div>
      )}

      {/* Navigation Buttons */}
      <div className={formStyles.formNavigation}>
        {step > 1 && (
          <button
            type="button"
            onClick={handlePrev}
            className={formStyles.buttonSecondary}
            disabled={loading}
          >
            ← Previous
          </button>
        )}

        {step < 5 && (
          <button
            type="button"
            onClick={handleNext}
            className={formStyles.buttonPrimary}
            disabled={loading}
          >
            Next →
          </button>
        )}

        {step === 5 && (
          <button
            type="submit"
            className={formStyles.buttonPrimary}
            disabled={loading}
          >
            {loading ? "Creating..." : "Create Listing"}
          </button>
        )}
      </div>
    </form>
  );
}
