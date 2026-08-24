export function localizeSpeed(speed: string): string {
  return {
    steady: 'Stabil',
    fast: 'Cepat',
    ultra: 'Sangat cepat',
  }[speed] || speed
}

export function localizeStatus(status: string): string {
  return {
    pending: 'Menunggu',
    approved: 'Disetujui',
    rejected: 'Ditolak',
  }[status] || status
}
