// From Uiverse.io by Na3ar-17
import React from "react";
import "./SearchInput.css";

export default function SearchInput({ name = "search", placeholder = "Kërko...", ...props }) {
  return (
    <label className="label">
      <input placeholder={placeholder} className="input search-input" name={name} type="text" {...props} />
    </label>
  );
}
