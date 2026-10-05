"use client";

import SearchableMultiSelect from "@/components/SearchableMultiSelect/SearchableMultiSelect";
import { isEventCategoryTagName } from "@/lib/event-categories.mjs";

const SUGGESTED_TAG_PREFIX = "suggested:";
const MAX_TAGS = 5;

export default function BusinessTaxonomyFields({ categories = [], tags = [], value, onChange }) {
  const suggestedNames = [...new Set(value.newTags.split(",").map((name) => name.trim()).filter(Boolean))];
  const suggestedOptions = suggestedNames.map((name) => ({ id: `${SUGGESTED_TAG_PREFIX}${name}`, name }));
  const tagOptions = [...tags, ...suggestedOptions];
  const selectedTags = [...value.tagIds, ...suggestedOptions.map((option) => option.id)];

  function changeTags(selected) {
    onChange({
      tagIds: selected.filter((id) => !id.startsWith(SUGGESTED_TAG_PREFIX)),
      newTags: selected.filter((id) => id.startsWith(SUGGESTED_TAG_PREFIX))
        .map((id) => id.slice(SUGGESTED_TAG_PREFIX.length)).join(", "),
    });
  }

  return <>
    <SearchableMultiSelect
      label="Business categories"
      options={categories}
      selected={value.categoryIds}
      onChange={(categoryIds) => onChange({ categoryIds })}
      placeholder="Select business categories"
      hint="Choose the categories customers should find you under."
    />
    <SearchableMultiSelect
      label="Tags"
      options={tagOptions}
      selected={selectedTags}
      onChange={changeTags}
      limit={MAX_TAGS}
      placeholder="Select tags or suggest a new one"
      hint="Choose or suggest up to five tags. New suggestions are reviewed with your listing."
      createOptionLabel="Suggest"
      canCreateOption={(query) => query.length <= 50 && !query.includes(",") &&
        /[a-z0-9]/i.test(query) && !isEventCategoryTagName(query)}
      onCreateOption={(query) => {
        if (selectedTags.length < MAX_TAGS) changeTags([...selectedTags, `${SUGGESTED_TAG_PREFIX}${query.trim()}`]);
      }}
    />
  </>;
}
