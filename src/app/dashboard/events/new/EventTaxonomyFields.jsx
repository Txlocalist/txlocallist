"use client";

import { useState } from "react";
import SearchableMultiSelect from "@/components/SearchableMultiSelect/SearchableMultiSelect";
import { EVENT_CATEGORY_LIMIT, EVENT_TAG_LIMIT, isEventCategoryTagName } from "@/lib/event-categories.mjs";

export function EventCategoryField({ categories, initialCategoryIds = [], error }) {
  const [selected, setSelected] = useState(initialCategoryIds);

  return <>
    {selected.map((id) => <input key={id} type="hidden" name="categoryIds" value={id} />)}
    <SearchableMultiSelect
      label="Happening Categories"
      options={categories}
      selected={selected}
      onChange={setSelected}
      limit={EVENT_CATEGORY_LIMIT}
      hint={`Required. Choose 1–${EVENT_CATEGORY_LIMIT} categories.`}
      placeholder="Search happening categories"
      error={error}
    />
  </>;
}

export function EventTagField({ tags = [], initialTags = "", error }) {
  const [selected, setSelected] = useState(() => [...new Set(initialTags.split(",").map((tag) => tag.trim()).filter(Boolean))]);
  const names = [...new Set([...tags.map((tag) => tag.name), ...selected])]
    .filter((name) => !isEventCategoryTagName(name))
    .sort((a, b) => a.localeCompare(b));
  const options = names.map((name) => ({ id: name, name }));
  const canCreateOption = (query) => {
    const name = query.trim();
    return Boolean(name) && !name.includes(",") && /[a-z0-9]/i.test(name) &&
      !isEventCategoryTagName(name) && !names.some((option) => option.toLowerCase() === name.toLowerCase());
  };

  return <>
    <input type="hidden" name="tags" value={selected.join(", ")} />
    <SearchableMultiSelect
      label="Tags"
      options={options}
      selected={selected}
      onChange={setSelected}
      limit={EVENT_TAG_LIMIT}
      hint={`Choose or add up to ${EVENT_TAG_LIMIT} tags.`}
      placeholder="Search tags or add your own"
      canCreateOption={canCreateOption}
      onCreateOption={(query) => {
        if (selected.length < EVENT_TAG_LIMIT && canCreateOption(query)) {
          setSelected([...selected, query.trim()]);
        }
      }}
      error={error}
    />
  </>;
}
