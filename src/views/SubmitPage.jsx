"use client";

import { legalRules } from "../lib/constants";
import { SubmitPlaceForm } from "../components/SubmitPlaceForm";

export function SubmitPage() {
  return (
    <main className="page">
      <section className="section section--submit">
        <div className="submit-copy">
          <h1>Tambahkan tempat WiFi publik</h1>
          <p>
            Bantu komunitas Bandar Lampung menemukan internet yang jelas tanpa
            melanggar privasi. Setiap kiriman masuk moderasi sebelum tampil di
            direktori publik.
          </p>
          <div className="submit-copy__guidelines">
            <h3>Panduan Kontribusi</h3>
            <div className="policy-list">
              {legalRules.map((rule, index) => (
                <article key={rule} className="policy-list__item">
                  <span className="policy-list__number">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <p>{rule}</p>
                </article>
              ))}
            </div>
          </div>
        </div>

        <div className="panel">
          <SubmitPlaceForm />
        </div>
      </section>
    </main>
  );
}
