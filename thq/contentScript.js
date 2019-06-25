chrome.runtime.onMessage.addListener(function(request, sender) {
    if (request.UNID && document.cookie.indexOf('LtpaToken') > -1) {
        window.location.href = `${window.origin}/thq/nav/logout.htm`
        chrome.runtime.sendMessage({type: 'thq', message: "loggingOut", UNID: request.UNID})
    } else if (request.UNID && document.cookie.indexOf('LtpaToken') === -1) {
        // fullPath is to confirm that the user is on the login page
        // tire-hq.com/ will allways be the login page, but 
        // apps.tire-hq.com/ will never be the login page
        let fullPath = `${window.location.hostname.replace('www.', '')}${window.location.pathname}`
        if (fullPath === 'tire-hq.com/') {
            getPassword(request.UNID)
        } else {
            window.location.href = `https://www.tire-hq.com?UNID=${request.UNID}`
        }
    }
})

const content = {
    /**
     * Proxy the fetch requests to the background script
     */
    fetch: (url, init) => {
        return new Promise(resolve => {
            chrome.runtime.sendMessage({type: 'service-now', fetch: url, init}, function(response) {
                if (response.response) {
                    return resolve({
                        json: () => {
                            return response.response
                        }
                    })
                } else if (response.error) {
                    throw response.error
                } else {
                    throw new Error('Empty response body')
                }
            })
        })
    }
}

function getPassword(UNID) {
    if (UNID.length === 32) {
        chrome.storage.local.get(['serverAddr'], function(fields) {
            if (fields.serverAddr) {
                console.log(fields.serverAddr)
            }
        })
        content.fetch(`http://localhost:8080/detail?UNID=${UNID}&pwOnly=true`)
        .then(response => {
            return response.json()
        })
        .then(data => {
            if (data.error) alert(data.message)
            let un = document.getElementById('Username')
            let pw = document.getElementById('Password')
            if (data) {
                un.value = data.username
                pw.value = (atob(data.password).toString()).split('|')[0]
                document.querySelector('input.login_btn').click()
            }

        })
        .catch(err => {
            console.log(err)
        })
    }
}

function verifyLogin() {
    let user = document.querySelector('input[name=]').value.replace('*', '')
    chrome.runtime.sendMessage({type: 'thq', message: 'thqLoggedIn', user: user}, function (response) {
        if (response && !response.isCorrectUser) {
            window.location.href = `${window.origin}/thq/nav/logout.htm`
        }
    })
}

function inIframe () {
    try {
        return window.self !== window.top;
    } catch (e) {
        return true;
    }
}

function createHTTPLink() {
    const accountMenu = document.querySelector('.thq_account')
    if (accountMenu) {
        const li = document.createElement('li')
        const menuLink = document.createElement('a')
        // const menuItem = document.querySelector('.thq_account_item')
        li.classList.add('thq_account_item')
        menuLink.href = '#'
        menuLink.addEventListener('click', function() {
            window.location.href = window.location.href.replace('https', 'http')
        }, false)
        menuLink.innerText = 'Switch to HTTP'
        li.appendChild(menuLink)
        accountMenu.insertAdjacentElement('afterbegin', li)
    }
}

function toggleTirenet(e) {
    document.querySelector('[name=Tirenet]').value = 'off'
}

function handleOnLoad() {
    // Check if the user is on the login page (pathname and host) and ensure that the user is in a popup
    // ie we do not want users to be logging in through their normal tire-hq tabbed client
    String.prototype.decodePass = function() {
        let encodedArray = this.split('')
        let key = parseInt(encodedArray.slice(0, 2).join(''))
        if (key === NaN || key % 1 !== 0) {
            return this
        } else {
            let encoded = encodedArray.slice(2)
            let decodedArray = []
            for (let i = 0; i < encoded.length; i++) {
                decodedArray.push(String.fromCharCode(encoded[i].charCodeAt(0) - key))
            }
            return decodedArray.join('')
        }
    }

    String.prototype.encodeStr = function(key) {
        let plainText = this.split('')
        if (parseInt(key) === NaN || key % 1 !== 0) {
            return this
        } else {
            let encodedArray = []
            for (let i = 0; i < plainText.length; i++) {
                encodedArray.push(String.fromCharCode((plainText[i].charCodeAt(0)) + key))
            }
            key = key.toString()
            if (key.length < 2) {
                key = '0' + key
            }
            return btoa(`${key}${encodedArray.join('')}`)
        }
    }
    if (window.location.pathname === '/' && (window.location.host === 'www.tire-hq.com' && window.opener)) {
        if (window.location.search.indexOf('UNID=') > -1) {
            // At login page and there is a UNID query string parameter
            try {
                let params = new URLSearchParams(window.location.search)
                 let UNID = params.get('UNID')
                 if (UNID) {
                     chrome.runtime.sendMessage({type: 'thq', message: "newTHQ"})
                     getPassword(UNID)
                 } else {
                     return
                 }
            } catch (err) {
                console.log(err + 'occurred')
            }
        } else {
            chrome.runtime.sendMessage({type: 'thq', message: 'newTHQ'}, function (response) {
                if (response.UNID) {
                    getPassword(response.UNID)
                } else {
                    console.log('No UNID in pending')
                }
            })
        }
    } else if (window.location.pathname === '/' && window.location.host === 'www.tire-hq.com') {
        chrome.runtime.sendMessage({type: 'thq', message: 'thqLoginLoaded'}, function (response) {
            if (response && response.UNID) {
                getPassword(response.UNID)
            }
        })
    } else if (window.location.host === 'apps.tire-hq.com' && window.location.protocol === 'https:') {
        createHTTPLink()
    } else if (window.location.pathname === '/thq/sales/SalesCDI.htm' && document.querySelector('[name=Tirenet]')) {
        
    }
}

if (document.readyState == 'loading'){
    console.log('Not quite ready')
    document.addEventListener('DOMContentLoaded', handleOnLoad)
} else {
    handleOnLoad()
}