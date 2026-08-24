'use client'

import { Component } from 'react'
import { InfoBanner } from './ui'

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="page">
          <section className="section">
            <InfoBanner tone="danger">
              {this.props.fallbackMessage ||
                'Terjadi error. Silakan muat ulang halaman.'}
            </InfoBanner>
          </section>
        </main>
      )
    }

    return this.props.children
  }
}
