const EMAIL_FORMAT = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateRequiredValues(form) {
  if (!form) return false;

  const checkedRadioGroups = new Set();
  for (const field of form.querySelectorAll("[required]")) {
    if (field.type === "radio") {
      const groupKey = field.name || field.id || field;
      if (checkedRadioGroups.has(groupKey)) continue;
      checkedRadioGroups.add(groupKey);
      const group = field.name
        ? Array.from(form.elements).filter(
            (item) => item.type === "radio" && item.name === field.name,
          )
        : [field];
      const validationTarget = group.find((item) => item.required) || field;
      if (!validationTarget.dataset.requiredValidationBound) {
        const clearGroupMessage = () =>
          group.forEach((item) => item.setCustomValidity(""));
        group.forEach((item) => {
          item.addEventListener("input", clearGroupMessage);
          item.addEventListener("change", clearGroupMessage);
        });
        validationTarget.dataset.requiredValidationBound = "true";
      }
      group.forEach((item) => {
        if (item !== validationTarget) item.setCustomValidity("");
      });
      validationTarget.setCustomValidity(
        group.some((item) => item.checked) ? "" : "Select an option.",
      );
      continue;
    }

    if (!field.dataset.requiredValidationBound) {
      const clearCustomMessage = () => field.setCustomValidity("");
      field.addEventListener("input", clearCustomMessage);
      field.addEventListener("change", clearCustomMessage);
      field.dataset.requiredValidationBound = "true";
    }
    const value = String(field.value ?? "");
    let message = "";
    if (field.type === "checkbox" || field.type === "radio") {
      if (!field.checked) message = "This field is required.";
    } else if (field.type === "file") {
      if (!field.files?.length) message = "This field is required.";
    } else {
      if (!value.trim()) message = "This field is required.";
      else if (field.type === "email" && !EMAIL_FORMAT.test(value))
        message = "Enter a valid email address, such as name@example.com.";
      else if (field.minLength > 0 && value.length < field.minLength)
        message = `Enter at least ${field.minLength} characters.`;
      else if (field.maxLength > 0 && value.length > field.maxLength)
        message = `Enter no more than ${field.maxLength} characters.`;
    }
    field.setCustomValidity(message);
  }

  return form.reportValidity();
}
