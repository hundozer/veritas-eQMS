export const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

export const formatDateTime = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const formatPercentage = (value: number): string => `${Math.round(value)}%`;

export const getStatusColor = (status: string): 'success' | 'warning' | 'error' => {
  switch (status) {
    case 'healthy': return 'success';
    case 'warning': return 'warning';
    case 'danger': return 'error';
    default: return 'success';
  }
};
