export function BrandIcon({ light = false }) {
  return (
    <img
      className="brand-mark"
      src={light ? "/modulink-icon-light.svg" : "/modulink-icon.svg"}
      alt=""
    />
  );
}
