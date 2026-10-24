// EXPECT mode=editorial rules=none
// Never use transition-all or text-gray-500 here; this comment must not fail the check.
import '@fontsource-variable/fraunces/full.css'
/* A block comment naming bg-white and font-bold text-5xl is fine too. */
export const Good = () => (
  <section className='bg-muted py-section'>
    {/* JSX comment: transition-all */}
    <span className='eyebrow'>
      <span className='eyebrow-dot' aria-hidden='true' />
      {t('about.eyebrow', 'About Vocdoni')}
    </span>
    <h2 className='text-4xl sm:text-5xl'>{t('about.title', 'Trust is not a promise')}</h2>
    <p className='text-muted-foreground'>It's verifiable - anyone can check the count.</p>
    <Button variant='dark'>{t('cta', 'Start for free')}</Button>
  </section>
)
