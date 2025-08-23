// From Uiverse.io by Na3ar-17
import React from "react";
import "./NameInput.css";

export default function NameInput({ name = "name", placeholder = "Enter name", ...props }) {
  return (
    <label className="label">
      <input placeholder={placeholder} className="input" name={name} type="text" {...props} />
    </label>
  );
}
