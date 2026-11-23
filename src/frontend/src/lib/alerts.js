/** Pure helpers behind the alert panel. */

const SEVERITY_ORDER = { critical: 0, warning: 1, info: 2 }

export const SEVERITY_STYLES = {
  critical: {
    label: 'crítico',
    text: 'text-red-400',
    chip: 'border-red-500/40 bg-red-500/10 text-red-400',
  },
  warning: {
    label: 'atenção',
    text: 'text-amber-400',
    chip: 'border-amber-400/40 bg-amber-400/10 text-amber-400',
  },
  info: {
    label: 'info',
    text: 'text-sky-400',
    chip: 'border-sky-400/40 bg-sky-400/10 text-sky-400',
  },
}

/** Highest severity present in a list, or `null` when there is none. */
export function worstSeverity(alerts) {
  if (!Array.isArray(alerts) || alerts.length === 0) return null

  return alerts.reduce((worst, alert) => {
    const current = SEVERITY_ORDER[alert?.severity] ?? 2
    return current < (SEVERITY_ORDER[worst] ?? 2) ? alert.severity : worst
  }, 'info')
}

/**
 * Groups alerts by severity, preserving the API order inside each group.
 *
 * @returns {{critical: object[], warning: object[], info: object[]}}
 */
export function groupBySeverity(alerts) {
  const groups = { critical: [], warning: [], info: [] }
  if (!Array.isArray(alerts)) return groups

  for (const alert of alerts) {
    const key = Object.hasOwn(groups, alert?.severity) ? alert.severity : 'info'
    groups[key].push(alert)
  }

  return groups
}

/** Short badge text: `3 alertas`, `1 alerta`, or `sem alertas`. */
export function alertBadgeLabel(alerts) {
  const count = Array.isArray(alerts) ? alerts.length : 0
  if (count === 0) return 'sem alertas'
  return count === 1 ? '1 alerta' : `${count} alertas`
}
