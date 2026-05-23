import { useEffect, type ReactNode } from "react";

interface SliderProps {
  value: number; // 0..1
  onChange: (v: number) => void;
  label?: string;
  ariaLabel?: string;
}

export function Slider({ value, onChange, label, ariaLabel }: SliderProps) {
  return (
    <label className="slider">
      {label && <span className="slider__label">{label}</span>}
      <input
        type="range"
        min={0}
        max={100}
        value={Math.round(value * 100)}
        aria-label={ariaLabel ?? label}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
      />
      <span className="slider__value">{Math.round(value * 100)}</span>
    </label>
  );
}

interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
}

export function Modal({ title, onClose, children }: ModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal__head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Schließen">
            ✕
          </button>
        </div>
        <div className="modal__body">{children}</div>
      </div>
    </div>
  );
}

interface IconPickerProps {
  icons: string[];
  value: string;
  onChange: (icon: string) => void;
}

export function IconPicker({ icons, value, onChange }: IconPickerProps) {
  return (
    <div className="icon-picker">
      {icons.map((icon) => (
        <button
          key={icon}
          type="button"
          className={`icon-picker__btn${icon === value ? " is-active" : ""}`}
          onClick={() => onChange(icon)}
        >
          {icon}
        </button>
      ))}
    </div>
  );
}

interface ColorPickerProps {
  colors: string[];
  value: string;
  onChange: (color: string) => void;
}

export function ColorPicker({ colors, value, onChange }: ColorPickerProps) {
  return (
    <div className="color-picker">
      {colors.map((color) => (
        <button
          key={color}
          type="button"
          className={`color-picker__swatch${color === value ? " is-active" : ""}`}
          style={{ background: color }}
          aria-label={color}
          onClick={() => onChange(color)}
        />
      ))}
    </div>
  );
}
