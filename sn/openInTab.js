// Allow windows to be pushed to a service-now frame

const exemptions = [
    '/nav_to.do',
    '/navpage.do',
    '/'
]

function handleFramerizer(e) {
    if (e.keyCode === 65 && e.shiftKey && e.ctrlKey && window.top === window) {
        chrome.runtime.sendMessage({type: 'service-now', framerize: true, origin: window.location.origin, path: window.location.pathname + window.location.search})
    }
}

!function handleOnLoad() {
    const path = window.location.pathname
    if (!exemptions.includes(path)) {
        document.addEventListener('keyup', handleFramerizer, false)
    }
}()

// if (document.readyState === 'loading') {
//     document.addEventListener('DOMContentLoaded', handleOnLoad)
// } else {
//     handleOnLoad()
// }