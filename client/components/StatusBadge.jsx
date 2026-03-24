function StatusBadge({ label, state }) {
  return (
    <span className={`status-badge status-${state}`}>
      {label}
    </span>
  );
}

export default StatusBadge;
