import Link from 'next/link'
import Image from 'next/image'
import { formatDate } from '../lib/format'

export function SectionHeader({ eyebrow, title, description, action }) {
  return (
    <div className="section-header">
      <div>
        {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
      {action ? <div className="section-header__action">{action}</div> : null}
    </div>
  )
}

export function PlaceCard({ place, showBadge = true }) {
  return (
    <Link href={`/places/${place.id}`} className={`place-card place-card--link tone--${place.image_tone || 'lagoon'}`}>
      <div className="place-card__media">
        {place.image_url?.startsWith('http') ? <Image src={place.image_url} alt="" width={640} height={360} sizes="(max-width: 760px) 100vw, 33vw" /> : place.image_url ? <img src={place.image_url} alt="" loading="lazy" /> : null}
      </div>
      <div className="place-card__body">
        <div className="place-card__heading">
          <div>
            <h3>{place.name} {showBadge && place.is_hype ? <StatusPill tone="warning">HYPE</StatusPill> : null}</h3>
          </div>
        </div>
        {place.address ? <p className="place-card__address">{place.address}</p> : null}
        <span className="place-card__more">Selengkapnya &rarr;</span>
      </div>
    </Link>
  )
}

export function ReviewCard({ review }) {
  return (
    <article className="review-card">
      <div className="review-card__head">
        <div>
          <strong>{review.author_name}</strong>
          <span>{formatDate(review.created_at)}</span>
        </div>
        <div className="review-card__ratings">
          <span>Kecepatan {review.rating_speed}/5</span>
          <span>Kenyamanan {review.rating_comfort}/5</span>
        </div>
      </div>
      {review.image_url?.startsWith('http') ? (
        <Image className="review-card__image" src={review.image_url} alt="" width={720} height={420} sizes="(max-width: 760px) 100vw, 50vw" />
      ) : review.image_url ? (
        <img className="review-card__image" src={review.image_url} alt="" loading="lazy" />
      ) : null}
      <p>{review.comment}</p>
    </article>
  )
}

export function MetricTile({ label, value }) {
  return (
    <article className="metric-tile">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  )
}

export function MetricRow({ label, value, note }) {
  return (
    <div className="metric-row">
      <div>
        <strong>{label}</strong>
        {note ? <small>{note}</small> : null}
      </div>
      <span>{value}</span>
    </div>
  )
}

export function StarMeter({ label, value }) {
  const rounded = Math.round(value)
  const hasValue = value != null && Number(value) > 0
  const numeric = hasValue ? Number(value).toFixed(1) : null

  return (
    <div className="star-meter">
      <span>{label}</span>
      <div className="star-meter__row">
        <div className="star-meter__stars" aria-label={`${numeric ?? "belum ada rating"} dari 5`}>
          {[1, 2, 3, 4, 5].map((item) => (
            <span key={item} className={item <= rounded ? 'is-filled' : ''}>
              ★
            </span>
          ))}
        </div>
        <strong className="star-meter__value">{numeric ? `${numeric} / 5` : "—"}</strong>
      </div>
    </div>
  )
}

export function StatusPill({ children, tone = 'muted' }) {
  return <span className={`status-pill status-pill--${tone}`}>{children}</span>
}

export function CategoryIcon({ category, size = 28 }) {
  const icons = {
    'Cafe / Coffee Shop': 'hgi-coffee-02',
    'Coworking Space': 'hgi-computer',
    Library: 'hgi-book-open-02',
    'Campus Lounge': 'hgi-mortarboard-01',
    Restaurant: 'hgi-restaurant-01',
    'Rest Area': 'hgi-tree-01',
  }
  return (
    <i
      className={`hgi-stroke ${icons[category] || 'hgi-computer'}`}
      style={{ fontSize: size }}
      aria-hidden="true"
    />
  )
}

export function LoadingGrid() {
  return (
    <div className="loading-grid">
      {[1, 2, 3].map((item) => (
        <div key={item} className="loading-card" />
      ))}
    </div>
  )
}

export function InfoBanner({ children, tone = 'muted', style, className }) {
  return <div className={`info-banner info-banner--${tone}${className ? ` ${className}` : ''}`} style={style}>{children}</div>
}

export function LockGate({ title = 'Login untuk melihat', description, rows = [], compact = false, className }) {
  return (
    <div className={`lock-gate${compact ? ' lock-gate--compact' : ''}${className ? ` ${className}` : ''}`}>
      <div className="lock-gate__blur" aria-hidden="true">
        {rows.length ? (
          rows.map((row, index) => (
            <div className="lock-gate__row" key={index}>
              <span>{row.label}</span>
              <strong>{row.value}</strong>
            </div>
          ))
        ) : (
          <div className="lock-gate__row">
            <span>SSID</span>
            <strong>••••••••••</strong>
          </div>
        )}
      </div>
      <div className="lock-gate__overlay">
        <i className="hgi-stroke hgi-lock lock-gate__icon" aria-hidden="true" />
        <strong>{title}</strong>
        {description ? <span>{description}</span> : null}
      </div>
    </div>
  )
}

export function EmptyState({ title, description }) {
  return (
    <article className="empty-state">
      <h3>{title}</h3>
      <p>{description}</p>
    </article>
  )
}
