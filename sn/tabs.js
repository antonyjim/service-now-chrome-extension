chrome.runtime.onMessage.addListener(function(request, sender) {
    if (request.framerizer && request.path) {
        let frameId = 'frame' + Math.round(Math.random() * 100000000000)
        createTab({
            url: request.path,
            active: true,
            id: frameId
        })
    } else if (request.closeTab) {
        try {
            document.querySelector('a[data-ticket="' + request.closeTab + '"]')
                .nextElementSibling
                .click()
        } catch(e) {
            console.info('Attempted to close gsft_main.')
        }
    }
})

let activeAndOpenTab = 'frame1'

function setState() {
    let tabs = document.querySelectorAll('.servicenow-frame')
    let activeTab = document.querySelector('.tabbedFrame.activeFrame').id
    let state = {
        tabs: [],
        activeTab
    }
    tabs.forEach(tab => {
        state.tabs.push({
            id: tab.parentElement.id,
            url: tab.contentDocument.location.href
        })
    })
    chrome.runtime.sendMessage({type: 'service-now', stateChange: true, state})
}

function getState() {
    chrome.runtime.sendMessage({type: 'service-now', checkState: true}, function(response) {
        if (response && response.tabs && response.tabs.length > 0) {
            response.tabs.forEach(tab => {
                if (response.activeTab === tab.id) {
                    createTab({
                        url: tab.url,
                        active: true,
                        id: tab.id
                    })
                } else {
                    createTab({
                        url: tab.url,
                        active: false,
                        id: tab.id
                    })
                }

            })
        } else {
            setState()
        }
    })
}

function createTabbedInterface() {
    function setTabHeight() {
        document.querySelector('.activeFrame').style.height = 
            (document.querySelector('.navpage-main').clientHeight - 32) + 'px'
    }
    let mainTag = document.querySelector('.navpage-main') // Right before the frame begins
    let initialFrame = document.querySelector('#gsft_main') // iframe
    let newFrameParent = document.createElement('div') // To move initial frame parent; Bind to 
    let newFrameParentHeight = 0
    let newFrameContainer = document.createElement('div') // To hold all frames
    let tabInnerHTML = `
    <ul id="snCanvasTablist" role="tablist" class="nav nav-tabs sn-tabs-basic" aria-hidden="false">
        <li role="presentation" class="ng-scope active">
            <a role="tab" href="javascript:void(0)" tabindex="0" aria-selected="true" class="ng-binding" aria-hidden="false" data-for="frame1" id="tab-frame1">Home</a>
        </li>
    
        <li role="presentation" class="ng-scope" id="addTab">
            <a role="tab" href="javascript:void(0)" tabindex="0" aria-selected="false" class="ng-binding" aria-hidden="false" title="Create a new tab.">+</a>
            <button aria-label="Delete Tab" class="icon-trash hide" role="button"></button>
        </li>
    </ul>
    `
    initialFrame.addEventListener('load', nameTab)
    initialFrame.addEventListener('JSContentLoaded', selectDefaultValues)
    newFrameParentHeight = (mainTag.clientHeight - 32)
    newFrameParent.id = 'frame1'
    newFrameParent.style.height = newFrameParentHeight.toString() + 'px'
    newFrameParent.appendChild(initialFrame)
    newFrameParent.classList.add('tabbedFrame')
    newFrameParent.classList.add('activeFrame')
    newFrameContainer.id = 'frameContainer'
    newFrameContainer.classList.add('bg-white')
    // newFrameContainer.appendChild(createRingLoader())
    newFrameContainer.appendChild(newFrameParent)
    mainTag.innerHTML = tabInnerHTML
    mainTag.appendChild(newFrameContainer)
    document.getElementById('addTab').addEventListener('click', addTab)
    document.getElementById('tab-frame1').addEventListener('click', activateTab)
    setInterval(setTabHeight, 500)
    getState()
}

function nameTab(e) {
    let frame = e.target
    // Remove the back button from the frame
    // Unless it is the main frame
    // if (frame.id !== 'gsft_main' && frame.contentDocument.location.pathname === '/incident.do') {
    //    let sectionContentId = frame.contentDocument.querySelector('.section-content').id
    //    frame.contentDocument.querySelector(`nav[data-id=${sectionContentId}]`).querySelector('button').style.display = 'none'
    //}
    frame.classList.add('waiting-for-name')
    let titleInterval = setInterval(checkForTitleReady, 75) // Wait for page to finish loading to name the tab
    var counter = 0
    function checkForTitleReady() {
        let pendingFrame = document.querySelector('.waiting-for-name')
        if (pendingFrame === null) {
            // Frame does not exist
            clearInterval(titleInterval)
        }
        let title = pendingFrame.contentDocument.title || ''
        if (title.indexOf('ServiceNow') > -1 && counter < 10 && !title.message) {
            // Frame has loaded ServiceNow, counter is less than 10 and title does not contain an error
            clearInterval(titleInterval)
            pendingFrame.dispatchEvent(new Event('JSContentLoaded'))
            let formattedTitle = title.split('|')[0].trim()
            let state = pendingFrame.contentDocument.getElementById('incident.state')
            document.title = formattedTitle
            let tabToBeNamed = document.querySelector(`a[data-for=${pendingFrame.parentElement.id}`)
            if (pendingFrame.contentDocument.location.pathname === '/incident.do' && state && state.selectedOptions) {
                tabToBeNamed.innerText = `${formattedTitle} ${state.selectedOptions[0].innerText }`
            } else {
                tabToBeNamed.innerText = formattedTitle
            }
            tabToBeNamed.setAttribute('data-ticket', formattedTitle)
            pendingFrame.classList.remove('waiting-for-name')
        } else if (counter > 10) {
            clearInterval(titleInterval)
            pendingFrame.classList.remove('waiting-for-name')
            document.querySelector(`a[data-for=${pendingFrame.parentElement.id}`).innerText = 'ServiceNow'
        } else {
            counter++
        }
    }
}

function createTab({url, active, id}) {
    let frameParent = document.getElementById('frameContainer'),
    newTab = document.createElement('li'),
    newTabLink = document.createElement('a'),
    newTabDeleteButton = document.createElement('button'),
    newFrameDiv = document.createElement('div'),
    newFrame = document.createElement('iframe'),
    tabList = document.querySelector('#addTab')

    // Set the properties for the <li> element
    newTab.setAttribute('role', 'presentation')
    newTab.classList.add('ng-scope')

    // Set the properties for the <a> element
    newTabLink.href = 'javascript:void(0)'
    newTabLink.innerText = 'New Tab'
    newTabLink.classList.add('ng-binding')
    newTabLink.classList.add('servicenow-tab')
    newTabLink.setAttribute('aria-hidden', 'false')
    newTabLink.setAttribute('aria-selected', 'true')
    newTabLink.setAttribute('data-for', id)
    newTabLink.addEventListener('click', activateTab)

    // Set the properties for the <button> element
    newTabDeleteButton.setAttribute('aria-label', 'Delete Tab')
    newTabDeleteButton.classList.add('icon-trash')
    newTabDeleteButton.setAttribute('role', 'button')
    newTabDeleteButton.addEventListener('click', deleteRequestedTab)
    
    // Set the properties for the <frame> element
    newFrame.src = url
    newFrame.addEventListener('load', nameTab)
    newFrame.addEventListener('load', setState)
    newFrame.classList.add('servicenow-frame')
    if (newFrameUrl = '/incident.do?sys_id=-1') {
        newFrame.addEventListener('JSContentLoaded', selectDefaultValues)
    }
    
    // Set the properties for the frameDiv
    newFrameDiv.id = id
    newFrameDiv.classList.add('tabbedFrame')

    // Put it all together
    // Start with the tabs
    newTab.appendChild(newTabLink)
    newTab.appendChild(newTabDeleteButton)
    tabList.parentElement.insertBefore(newTab, tabList)

    // Then move to the frames
    newFrameDiv.appendChild(newFrame)
    frameParent.appendChild(newFrameDiv)
    if (active) {
        activateTab(null, id)
    }
}

function addTab(e) {
    chrome.storage.local.get(['newTabHref'], function(fields) {
        let newFrameUrl = '/incident.do?sys_id=-1'
        let frameId = 'frame' + Math.round(Math.random() * 100000000000)

        if (fields.newTabHref) {
            newFrameUrl = fields.newTabHref
        }
        if (e) {
            e.preventDefault()
        }
        createTab({
            url: newFrameUrl,
            active: true,
            id: frameId
        })
        setState()
    })
}

function deleteRequestedTab(e) {
    let frameId = e.target.previousElementSibling.getAttribute('data-for')
    let frameTab = document.getElementById(frameId)
    // Let fallback frame be the frame to focus into after deleting the frame
    // If no frame exists, create a new one at the end of the function
    let fallBackFrame = null
    if (frameId === activeAndOpenTab) {
        if (e.target.parentElement.previousElementSibling) {
            fallBackFrame = e.target.parentElement.previousElementSibling.children[0].getAttribute('data-for')
        } else if (e.target.parentElement.nextElementSibling) {
            fallBackFrame = e.target.parentElement.nextElementSibling.children[0].getAttribute('data-for')
        } else {
            fallBackFrame = false
        }
    }

    // Remove the frame
    frameTab.parentElement.removeChild(frameTab)
    e.target.parentElement.parentElement.removeChild(e.target.parentElement) 

    // Focus on existing frame, if no other frams are open, add a new frame
    if (fallBackFrame) {
        activateTab(null, fallBackFrame)
    }
    setState()
}

function activateTab(e, id) {
    let frameId
    if (e === null) {
        frameId = id
    } else {
        frameId = e.target.getAttribute('data-for')
    }
    try {
        var liTab = document.querySelector(`a[data-for=${frameId}]`).parentElement
    } catch (err) {
        throw err
    }
    let tabs = document.querySelectorAll('.tabbedFrame')
    let activeTab = null
    let toBeActiveTab = null
    for (let tab of tabs) {
        // activeTab and toBeActiveTab have both been found. Break the loop
        if (activeTab !== null && toBeActiveTab !== null) {
            break;
        }

        if (tab.classList.contains('activeFrame')) { // Deactive the active tab
            activeTab = tab
            tab.classList.remove('activeFrame')
            document.querySelector(`a[data-for=${activeTab.id}`).parentElement.classList.remove('active')
            continue;
        } else if (tab.id === frameId) { // Activate the requested tab
            document.title = liTab.innerText
            toBeActiveTab = tab
            activeAndOpenTab = tab.id
            tab.classList.add('activeFrame')
            continue;
        }
    }
    // If this is still null, then the requested frame does not exist
    // Default to displaying the already active tab
    if (toBeActiveTab === null) {
        liTab.classList.add('active')
        activeTab.classList.add('activeFrame')
        setState()
        return void 1
    } else {
        liTab.classList.add('active')
        fixTabHeight(toBeActiveTab)
        setState()
        // Return success
        return void 0
    }
}

function fixTabHeight(tab) {
    let mainTag = document.querySelector('.navpage-main') // Right before the frame begins
    let newFrameParentHeight = 0
    newFrameParentHeight = (mainTag.clientHeight - 32)
    tab.style.height = `${newFrameParentHeight}px`
}

function selectDefaultValues(e) {
    let qParams = new URLSearchParams(e.target.contentWindow.location.href.split('?')[1])
    // Only select defaults for new ticket
    if ((e.target.contentWindow.location.pathname === '/incident.do') && (qParams.get('sys_id') === null || qParams.get('sys_id') === '-1')) {
        chrome.storage.local.get(['defaultSelections', 'hideSuggestions'], function(fields) {
            if (fields.defaultSelections) {
                let doc = e.target.contentDocument
                if (fields.hideSuggestions) {
                    doc.getElementById('element.incident.short_description').nextElementSibling.style.display = 'none'
                }
                for (let elementToSelectValueFor of fields.defaultSelections) {
                    try {
                        doc.getElementById(elementToSelectValueFor.el).value = elementToSelectValueFor.selected
                        doc.getElementById(elementToSelectValueFor.el).dispatchEvent(new Event('change'))                        
                    } catch(err) {
                        console.info(err)
                    }

                }
            }
        })
    }
}

function handleOnLoad() {
    var jsFinishTimer = setInterval(checkForFinishedLoadingJS, 50)
    var counter = 0
    function checkForFinishedLoadingJS () {
        let gsft_main = document.querySelector('#gsft_main')
        if ((gsft_main !== null && gsft_main.src !== 'about:blank') && counter < 10) {
            clearInterval(jsFinishTimer)
            createTabbedInterface()
        } else {
            counter++
        }
    }
}

chrome.storage.local.get(['enabledHosts', 'tabsEnabled'], function(fields) {
    // Check to see if it is enabled for this host
    if (fields.enabledHosts && fields.enabledHosts[window.location.host] && fields.tabsEnabled) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', handleOnLoad)
        } else {
            handleOnLoad()
        }
    } else {
        document.getElementById('gsft_main').addEventListener('load', nameTab, true)
        document.getElementById('gsft_main').addEventListener('JSContentLoaded', selectDefaultValues)
    }
})
