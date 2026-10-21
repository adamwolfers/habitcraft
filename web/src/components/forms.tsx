import { useId, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react';

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

/** A labelled input. The browser enforces its required, type and length rules. */
export function Field({ label, ...input }: FieldProps) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-gray-300">
        {label}
      </label>
      <input
        id={id}
        className="rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-gray-100 focus:border-blue-400 focus:outline-none"
        {...input}
      />
    </div>
  );
}

/** Why the last attempt failed. Screen readers announce it as it appears. */
export function ErrorMessage({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="rounded-md border border-red-500 bg-red-950 px-3 py-2 text-red-200">
      {children}
    </p>
  );
}

/** That the last attempt worked, where nothing else on screen shows it. */
export function SuccessMessage({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p
      role="status"
      className="rounded-md border border-green-600 bg-green-950 px-3 py-2 text-green-200"
    >
      {children}
    </p>
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger';
};

const VARIANTS = {
  primary: 'bg-blue-600 text-white hover:bg-blue-500',
  secondary: 'border border-gray-600 text-gray-200 hover:bg-gray-800',
  danger: 'bg-red-700 text-white hover:bg-red-600',
};

export function Button({ variant = 'primary', className = '', ...button }: ButtonProps) {
  return (
    <button
      className={`rounded-md px-3 py-2 text-sm font-medium disabled:opacity-50 ${VARIANTS[variant]} ${className}`}
      {...button}
    />
  );
}
