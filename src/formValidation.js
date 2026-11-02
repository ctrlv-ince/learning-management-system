export function validateRequiredValues(form) {
  if (!form) return false;

  for (const field of form.querySelectorAll("[required]")) {
    if (!field.dataset.requiredValidationBound) {
      const clearCustomMessage = () => field.setCustomValidity("");
      field.addEventListener("input", clearCustomMessage);
      field.addEventListener("change", clearCustomMessage);
      field.dataset.requiredValidationBound = "true";
    }
    let missing = false;
    if (field.type === "checkbox" || field.type === "radio") {
      missing = !field.checked;
    } else if (field.type === "file") {
      missing = !field.files?.length;
    } else {
      missing = !String(field.value ?? "").trim();
    }
    field.setCustomValidity(missing ? "This field is required." : "");
  }

  return form.reportValidity();
}
