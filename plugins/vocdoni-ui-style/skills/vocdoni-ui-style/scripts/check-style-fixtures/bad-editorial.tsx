// EXPECT mode=editorial rules=editorial-no-gray,editorial-no-white,editorial-serif-weight,editorial-signal-dot-only,fraunces-full,no-em-dash,no-transition-all,sentence-case
import '@fontsource-variable/fraunces/wght.css'

export const Bad = () => (
  <section className='bg-white text-gray-600 transition-all'>
    <h1 className='text-5xl font-bold'>{t('hero.title', 'Secure Voting For Everyone')}</h1>
    <p>
      {t(
        'hero.lede',
        'Fast — and secure'
      )}
    </p>
    <div className='bg-signal p-8 rounded-xl'>Promo</div>
  </section>
)
