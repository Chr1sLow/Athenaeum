import type { AdminCell, AdminColumn } from '@athenaeum/shared';
import { TextField } from '../../../components/TextField/TextField.tsx';
import { type FormValue, fullCell } from '../adminCells.ts';
import { CheckboxField } from '../CheckboxField/CheckboxField.tsx';
import { ReadOnlyField } from '../ReadOnlyField/ReadOnlyField.tsx';
import { SelectField } from '../SelectField/SelectField.tsx';

export interface RowFieldProps {
  column: AdminColumn;
  value: FormValue;
  /** The value in the database, shown for read-only columns. */
  savedValue: AdminCell;
  onChange(value: FormValue): void;
}

const NULL_HINT = 'Leave empty for NULL.';

/** The right input for one column of the row being edited. */
export function RowField({ column, value, savedValue, onChange }: RowFieldProps) {
  const { name } = column;
  if (!column.editable) return <ReadOnlyField label={name} value={fullCell(column, savedValue)} />;

  if (column.type === 'boolean') return <CheckboxField label={name} checked={value === true} onChange={onChange} />;

  const text = String(value);
  if (column.type === 'enum') {
    const options = [
      ...(column.nullable ? [{ value: '', label: 'NULL' }] : []),
      ...(column.enumValues ?? []).map((v) => ({ value: v, label: v })),
    ];
    return <SelectField label={name} value={text} options={options} onChange={onChange} />;
  }

  const numeric = column.type === 'integer' || column.type === 'number';
  const hints = [
    column.type === 'timestamp' && 'UTC, like 2026-01-31T12:00:00.000Z.',
    column.references && `The id of a row in ${column.references}.`,
    column.nullable && NULL_HINT,
  ].filter(Boolean);

  return (
    <TextField
      label={name}
      type={numeric ? 'number' : 'text'}
      step={column.type === 'number' ? 'any' : undefined}
      inputMode={numeric ? 'decimal' : undefined}
      autoComplete="off"
      spellCheck={column.type === 'text'}
      value={text}
      hint={hints.join(' ') || undefined}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
