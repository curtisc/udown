// Runs before React hydration to prevent flash of wrong theme (FOUC)
;(function () {
  var t = localStorage.getItem('theme')
  if (t === 'dark' || (!t && matchMedia('(prefers-color-scheme:dark)').matches)) {
    document.documentElement.classList.add('dark')
  }
})()
