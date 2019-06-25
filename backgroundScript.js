// Set the default options in chrome.storage.local
chrome.runtime.onInstalled.addListener(function(details) {
    if (details.reason === 'install') {
        chrome.tabs.create({url: "help.html"})
        fetch('/defaultSettings.json')
        .then(response => {
            return response.json()
        })
        .then(settings => {
            chrome.storage.local.set(settings)
        })
        .catch(err => {
            alert(err)
        })
    }
})

// Allow the popup to be displayed on service-now
chrome.declarativeContent.onPageChanged.removeRules(undefined, function() {
    chrome.declarativeContent.onPageChanged.addRules([
        {
          conditions: [new chrome.declarativeContent.PageStateMatcher({
            pageUrl: {hostEquals: 'goodyeardev.service-now.com', schemes: ["https"]},
          }) 
          ],
              actions: [new chrome.declarativeContent.ShowPageAction()]
        }, 
        {
          conditions: [new chrome.declarativeContent.PageStateMatcher({
            pageUrl: {hostEquals: 'goodyear.service-now.com', schemes: ["https"]},
          })
          ],
              actions: [new chrome.declarativeContent.ShowPageAction()]
        },
        {
          conditions: [new chrome.declarativeContent.PageStateMatcher({
            pageUrl: {hostEquals: 'goodyeartest.service-now.com', schemes: ["https"]},
          })
          ],
              actions: [new chrome.declarativeContent.ShowPageAction()]
        }
    ]);
});

var pendingUNID = null
var pendingTicketClose = {}
var thqWindow = {
    id: false,
    loggedIn: false
}
var snStates = {}

chrome.runtime.onMessage.addListener(
    function (request, sender, sendResponse) {
        /**
         * This script will accept 2 message types:
         * 
         * service-now: All requests coming from service-now such as ticket
         * closure requests, login requests, ticket status request
         * 
         * thq: All requests coming from thq window. Mainly when a new window is loaded
         */
        messageSwitch:
        switch(request.type) {
            case "service-now": {
                if (request.action && request.ticket) {
                    // Check for first call resolution request
                    let checkForPendingTicket = pendingTicketClose[request.ticket]
                    if (request.action === 'FCR' ) {
                        // Set pending close
                        pendingTicketClose[request.ticket] = 'NEW'
                    } else if (request.action === 'Loaded Ticket' && request.ticket) {
                        // Check for existing FCR request
                        if (checkForPendingTicket && (checkForPendingTicket === 'NEW' || checkForPendingTicket === 'AWAITING CLOSURE')) {
                            checkForPendingTicket = 'AWAITING CLOSURE'
                            sendResponse({error: false, closeNow: true, state: checkForPendingTicket})
                        } else if (checkForPendingTicket === 'ASSIGNED') {
                            sendResponse({error: false, closeNow: true, state: checkForPendingTicket})
                        } else if (checkForPendingTicket === 'REASSIGNED') {
                            sendResponse({error: false, closeNow: true, state: checkForPendingTicket})
                        } else {
                            sendResponse({error: false, closeNow: false, state: checkForPendingTicket})
                        }
                    } else if (request.action === 'Assigned Ticket' && request.ticket) {
                        pendingTicketClose[request.ticket] = 'ASSIGNED'
                    } else if (request.action === 'Reassigned Ticket' && request.ticket) {
                        pendingTicketClose[request.ticket] = 'REASSIGNED'
                    } else if (request.action === 'Closed ticket' && request.ticket) {
                        pendingTicketClose[request.ticket] = 'CLOSED'
                        sendResponse({error: false, message: 'Ticket removed', state: checkForPendingTicket})
                    } else if (request.action === 'Close Tab' && request.ticket && request.origin) {
                        findSNTab(request.origin)
                        .then(tabFound => {
                            delete pendingTicketClose[request.ticket]
                            chrome.tabs.sendMessage(tabFound, {closeTab: request.ticket})
                        })
                        .catch(err => {
                            // No open tabs found. This should not ever happen
                            console.error(err)
                        })
                    } else {
                        sendResponse({error: true, message: 'No action specified', state: checkForPendingTicket})
                    }
                } else if (request.UNID && thqWindow.id !== null) {
                    validateTab()
                    .then(ifExists => {
                        pendingUNID = request.UNID
                        sendResponse({openTab: true})
                        chrome.tabs.sendMessage(ifExists.id, {newLogin: true, UNID: request.UNID})
                    }, doesNotExist => {
                        pendingUNID = request.UNID
                        sendResponse({openTab: false})
                    })
                    .catch(err => {
                        sendResponse({openTab: false})
                    })
                    return true;
                } else if (request.stateChange && request.state) { 
                    /**
                     * Maintain the state of current tabs open in the sender's tab
                     */
                    snStates[sender.tab.id] = request.state
                } else if (request.fetch) {
                    // Proxy fetch requests from the content script
                    let init = request.init || {}
                    fetch(request.fetch, init)
                    .then(response => {
                        return response.json()
                    })
                    .then(data => {
                        sendResponse({response: data})
                    })
                    .catch(e => {sendResponse({error: e})})
                    return true
                } else if (request.checkState) {
                    // Check state will send a list of tabs that should be opened by SN
                    if (snStates[sender.tab.id]) {
                        sendResponse(snStates[sender.tab.id])
                    } else {
                        sendResponse({state: []})
                    }
                } if (request.framerize && request.origin) {
                    findSNTab(request.origin)
                    .then(tabFound => {
                        chrome.tabs.remove([sender.tab.id])
                        chrome.tabs.sendMessage(tabFound, {framerizer: true, path: request.path})
                        chrome.tabs.update(tabFound, {active: true})
                    }, noTabFound => {
                        chrome.tabs.remove([sender.tab.id])
                        chrome.tabs.create({url: request.origin + '/nav_to.do?uri=' + encodeURIComponent(request.path || '/')})
                    })
                    .catch(err => {
                        chrome.tabs.remove([sender.tab.id])
                        chrome.tabs.create({url: request.origin + '/nav_to.do?uri=' + encodeURIComponent(request.path || '/')})
                    })
                } else {
                    sendResponse({openTab: false})
                }
                break messageSwitch;
            }

            case "thq": {
                thqSwitch:
                switch(request.message) {
                    case "newTHQ" : {
                        if (sender.tab.url.indexOf('tire-hq.com') > -1) {
                            thqWindow.id = sender.tab.windowId
                            sendResponse({message: "added", UNID: pendingUNID})
                        }
                        break thqSwitch;
                    }
                    case "loggingOut" : {
                        pendingUNID = request.UNID
                        break thqSwitch;
                    }
                    case "thqLoginLoaded" : {
                        if (pendingUNID && sender.tab.windowId === thqWindow.id) {
                            sendResponse({message: 'pendingUNID', UNID: pendingUNID})
                        } else {
                            sendResponse({message: 'No Pending UNID'})
                        }
                        break thqSwitch
                    }
                    case "pendingUNIDReceived" : {
                        pendingUNID = null
                        break thqSwitch
                    }
                    default : {
                        sendResponse({openTab: false})
                        return true;
                    }
                } // thqSwitch
                break messageSwitch
            }
            default : {
                void 0
            }
        } // messageSwitch
    }
)

function validateTab() {
    return new Promise((resolve, reject) => {
        chrome.tabs.query({windowId: thqWindow.id}, tabs => {
            if (tabs.length > 0) {
                resolve(tabs[0])
            } else {
                reject()
            }
        })
    })
}

function findSNTab(origin) {
    return new Promise((resolve, reject) => {
        chrome.tabs.query({url: `${origin}/nav_to.do*`}, tabs => {
            if (tabs.length > 0) {
                if (tabs[0].length > 1) {
                    for (tab of tabs) {
                        if (snStates[tab.id]) {
                            resolve(tab.id)
                            break
                        }
                    }
                    reject(null)
                } else {
                    if (snStates[tabs[0].id]) {
                        resolve(tabs[0].id)
                    }
                }
            } else {
                reject(null)
            }
        })
    })
}