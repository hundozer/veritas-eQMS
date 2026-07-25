'use client';
import { Stack, Chip, Button } from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';

interface FilterChipsProps {
  filters: string[];
  onRemove: (filter: string) => void;
  onAdd?: () => void;
}

export function FilterChips({ filters, onRemove, onAdd }: FilterChipsProps) {
  return (
    <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap', gap: 1 }}>
      {onAdd && (
        <Button
          variant="outlined"
          size="small"
          startIcon={<AddIcon />}
          onClick={onAdd}
          sx={{ borderRadius: 2, borderStyle: 'dashed' }}
        >
          Add filter
        </Button>
      )}
      {filters.map((filter) => (
        <Chip
          key={filter}
          label={filter}
          onDelete={() => onRemove(filter)}
          variant="outlined"
          size="small"
        />
      ))}
    </Stack>
  );
}
