// EXPECT mode=editorial rules=editorial-no-white,no-transition-all
// A regex literal containing "/*" must not swallow the rest of the file.
const slashOrStar = /[/*]/
const ratio = 10 / 2 / 5
export const R = () => <div className='bg-white transition-all'>{ratio}</div>
