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
        {place.image_url ? <Image src={place.image_url} alt="" width={640} height={360} sizes="(max-width: 760px) 100vw, 33vw" /> : null}
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
          <StatusPill tone="info">Kecepatan {review.rating_speed}/5</StatusPill>
          <StatusPill tone="muted">Kenyamanan {review.rating_comfort}/5</StatusPill>
        </div>
      </div>
      {review.image_url?.startsWith('http') ? (
        <Image className="review-card__image" src={review.image_url} alt="" width={720} height={420} sizes="(max-width: 760px) 100vw, 50vw" />
      ) : review.image_url ? (
        <img className="review-card__image" src={review.image_url} alt="" loading="lazy" />
      ) : null}
      <h3>{review.review_title || 'Ulasan pengunjung'}</h3>
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

  return (
    <div className="star-meter">
      <span>{label}</span>
      <div className="star-meter__stars" aria-label={`${value} dari 5`}>
        {[1, 2, 3, 4, 5].map((item) => (
          <span key={item} className={item <= rounded ? 'is-filled' : ''}>
            ★
          </span>
        ))}
      </div>
    </div>
  )
}

export function StatusPill({ children, tone = 'muted' }) {
  return <span className={`status-pill status-pill--${tone}`}>{children}</span>
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

export function EmptyState({ title, description }) {
  return (
    <article className="empty-state">
      <h3>{title}</h3>
      <p>{description}</p>
    </article>
  )
}
