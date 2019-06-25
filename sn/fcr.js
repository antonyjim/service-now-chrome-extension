"use strict"
let localServerAddress = ''
, maxResults = 15;
const callerIdField = 'sys_display.incident.caller_id'
, incidentDescriptionField = 'incident.description'
, navbarSelector = '.navbar_ui_actions'
, closeNotesField = 'incident.close_notes'
, closeCodeField = 'incident.close_code'
, incNumField = 'sys_readonly.incident.number'
, shortDescField = 'incident.short_description'
, saveButton = 'sysverb_insert_and_stay'
, preferredContactField = 'incident.u_preferred_contact_number_caller'
, workNotesOnOpenTicketField = 'activity-stream-work_notes-textarea'
, assignmentGroupField = 'incident.assignment_group'
, locationField = 'incident.u_location'
, descriptionField = 'incident.description'
, navHeader = 'incident.form_header';

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

/**
 * Create an action button to put in the nav bar on new incidents.
 * @param {newEl, innerText, listenOn, eventHandler} actionDetails Create a new action button on the nav bar
 */
function createActionButton({newEl, innerText, listenOn, eventHandler}) {
    var button = document.createElement('button')
    button.classList.add('form_action_button', 'header', 'action_context', 'btn', 'btn-default')
    button.type = 'button'
    button.id = newEl
    button.innerText = innerText
    if (listenOn && eventHandler) {
        button.addEventListener(listenOn, eventHandler)
    }
    document.querySelector(navbarSelector).appendChild(button)
}

/**
 * Loop through all action buttons and return the one matching the requested
 * inner text parameter.
 * @param {string} innerText The inner text of the action button to be returned
 */
function selectActionButton(innerText) {
    for (let button of (document.querySelector(navbarSelector).querySelectorAll('button'))) {
        if (button.innerText === innerText) {
            return button
        }
    }
    return null
}

/**
 * Validate the Resolution Fields. If either one is blank do nothing
 */
function firstCallClose() {
    const type = 'service-now'
    const action = 'FCR'
    const notes = document.getElementById(closeNotesField).value
    const code = document.getElementById(closeCodeField).value
    const ticket = document.getElementById(incNumField).value
    if (notes && code) {
        chrome.runtime.sendMessage({type, action, ticket});
        document.getElementById(shortDescField).value = 'FCR: ' 
            + document.getElementById(shortDescField).value;
        document.getElementById(saveButton).click();
    } else if (!notes && !code) {
        alert('Resolution notes and resolution code are blank')
    } else if (!notes) {
        alert('Resolution notes are not completed')
    } else if (!code) {
        alert('Resolution code is not selected.')
    }
}

/**
 * Query the background script for the state of the current ticket.
 * If there is no ticket returned, do nothing. If there is a ticket,
 * try to close it.
 */
function checkForFirstCallClose() {
    const type = 'service-now'
    const action = 'Loaded Ticket'
    let ticket = document.getElementById(incNumField).value
    chrome.runtime.sendMessage({type, action, ticket}, function(response) {
        if (response.closeNow || response.state) {
            if (selectActionButton('Assign to me') && response.closeNow) {
                if (response.state === 'ASSIGNED' && response.closeNow) {
                    window.alert('Ticket has already been assigned. Please change your assignment group in settings.')
                } else if (response.closeNow) {
                    // Ticket is in correct assignment group, but is not assigned
                    let waitForPhone = setInterval(checkForReadyPhoneFieldToAssign, 50)
                    function checkForReadyPhoneFieldToAssign() {
                        if (document.getElementById(preferredContactField).children.length > 0 
                        && document.getElementById(preferredContactField).value) {
                            clearInterval(waitForPhone)
                            chrome.runtime.sendMessage({type: 'service-now', action: 'Assigned Ticket', ticket: ticket})
                            // let userId = document.querySelector('#incident\\.opened_by').value
                            // document.querySelector('#incident\\.assigned_to').value = userId
                            // let button = document.createElement('button')
                            // button.setAttribute('onclick', "gsftSubmit(undefined, document.querySelector('form[name=\"incident.do\"]'), 'resolve_incident1')")
                            // document.body.appendChild(button)
                            // button.click()
                            selectActionButton('Assign to me').click()
                        }
                    }
                }
            } else if (selectActionButton('Resolve Incident') && response.closeNow) {
                // Ticket is in correct assignment group and is assigned
                chrome.runtime.sendMessage({type: 'service-now', action: 'Closed ticket', ticket: ticket})
                if (document.getElementById(preferredContactField).children.length > 0) {
                    selectActionButton('Resolve Incident').click()
                } else {
                    let waitForPhone = setInterval(checkForReadyPhoneField, 50)
                    function checkForReadyPhoneField() {
                        if (document.getElementById(preferredContactField).children.length > 0 
                        && document.getElementById(preferredContactField).value) {
                            clearInterval(waitForPhone)
                            selectActionButton('Resolve Incident').click()
                        }
                    } 
                }
            } else if (response.state === 'CLOSED') {
                // Close the tab
                chrome.runtime.sendMessage({type: 'service-now', action: 'Close Tab', ticket, origin: window.location.origin})
            } else {
                // Ticket is in incorrect assignment group
                if (response.state === 'REASSIGNED' && response.closeNow) {
                    window.alert('Ticket has already been reassigned. Please change your assignment group in settings.')
                } else if (response.closeNow) {
                    if (document.getElementById(preferredContactField).children.length > 0) {
                        chrome.runtime.sendMessage({type: 'service-now', action: 'Reassigned Ticket', ticket})
                        changeAssignmentGroup()
                    } else {
                        let waitForPhone = setInterval(checkForReadyPhoneToReassign, 50)
                        function checkForReadyPhoneToReassign() {
                            if (document.getElementById(preferredContactField).children.length > 0) {
                                clearInterval(waitForPhone)
                                chrome.runtime.sendMessage({type: 'service-now', action: 'Reassigned Ticket', ticket: ticket})
                                changeAssignmentGroup()
                            }
                        } 
                    }
                }
            }
        }
    })
}

/**
 * If the ticket is assigned to the incorrect assignment group,
 * reassign the ticket to the assignment group in the 'usersAssignmentGroup'
 * key. If there is no assignment group defined, default to the agents queue.
 */
function changeAssignmentGroup() {
    chrome.storage.local.get(['usersAssignmentGroup'], function(results) {
        let workNotes = document.getElementById(workNotesOnOpenTicketField)
        if (results.usersAssignmentGroup && results.usersAssignmentGroup.sys) {
            // Grab the user's set assignment group from local storage
            let groupField = document.getElementById(assignmentGroupField)
            groupField.value = results.usersAssignmentGroup.sys
            groupField.dispatchEvent(new Event('change'))
            workNotes.value = `Reassigning to ${results.usersAssignmentGroup.name} for closure.`
            workNotes.dispatchEvent(new Event('change'))
            selectActionButton('Save').click()
        } else {
            // Default to the agents queue
            chrome.storage.local.get(['assignmentGroups'], function(allGroups) {
                let groupField = document.getElementById(assignmentGroupField)
                groupField.value = allGroups['NAUSAK_GBMS_AGENTS']
                groupField.dispatchEvent(new Event('change'))
                workNotes.value = `Reassigning to NAUSAK_GBMS_AGENTS for closure.`
                workNotes.dispatchEvent(new Event('change'))
                selectActionButton('Save').click()
            })
        }
    })
}

function getUserDetails(UNID) {
    return new Promise((resolve, reject) => {
        if (UNID.length !== 32) {
            reject('Invalid UNID')
        } else {
            content.fetch(`${localServerAddress}/detail?UNID=${UNID}`)
            .then(response => {
                return response.json()
            })
            .then(data => {
                if (data.error) {
                    alert(data.message)
                }
                insertUserDataIntoPopup(data)
                resolve(true)
            })
            .catch(err => {
                console.error(err)
                throw err
            }) 
        }
    })
}

function removeLeadingZeros(nonsig) {
    nonsig = nonsig.toString().split('')
    for (let i = 0; i < nonsig.length; i++) {
        if (nonsig[i] === "0") {
            continue;
        } else {
            nonsig = nonsig.slice(i)
            break;
        }
    }
    return nonsig.join('');
}

function movePopupWhileLoading(e) {
    let popup = document.getElementById('thqPopup')
    popup.style.left = (e.layerX - 10) + 'px'
    popup.style.top = (e.layerY - 10) + 'px'
    popup.style.visibility = 'visible'
    popup.addEventListener('mouseleave', closePopup)
}

function searchSelectedCustomer(e) {
    let customer = e.target.getAttribute('data-customer')
    let searchButton = document.getElementById('thqSearchButton')
    document.getElementById('thq.username').value = customer
    searchButton.click()
}

function enableSelectedButtonIfCustomerSelected(e) {
    let customer = document.getElementById(locationField)
    let button = document.getElementById('thq.selected.customer')
    if (customer.value.slice(0, 8) === 'Customer' && customer.value.split('/') && customer.value.split('/')[3] !== '111111') {
        let nonsig = customer.value.split('/')[3]
        if (parseInt(nonsig) === NaN) {
            button.style.display = 'none'
        } else {
            button.setAttribute('data-customer', nonsig)
            button.style.display = 'table-cell'
        }
    } else {
        button.style.display = 'none'
    }
}

function sendUNIDToTHQ(e) {
    document.getElementById('closeTHQModal').click()
    let UNID = e.target.previousElementSibling.value
    chrome.runtime.sendMessage({type: "service-now", stoWindow: 'THQ', UNID: UNID}, function(response) {
        let desc = document.getElementById(descriptionField)
        let lineCount = 0
        let enteredUsername = false
        let lines = desc.value.split('\n')
        let username = e.target.innerText
        for (let line of lines) {
            if(line.slice(0, 10) === 'Username: ') {
                let restOfLine = line[lineCount].split(' ').slice(2).join(' ')
                lines[lineCount] = 'Username: ' + username + ' ' + restOfLine
                document.getElementById(incidentDescriptionField).value = lines.join('\n')
                enteredUsername = true
                break
            }
            lineCount++
        }
        if (!enteredUsername) {
            desc.value = 'Username: ' + username + '\n' + desc.value
        }
        if (!response === undefined) {
            window.open(`https://apps.tire-hq.com/thq/nav/logout.htm`, '_blank', 'toolbar,scrollbars,resizeable')
        } else if (response && response.openTab) {
            void 0
        } else {
            // Fallback to opening a new tab
            window.open(`https://apps.tire-hq.com/thq/nav/logout.htm`, '_blank', 'toolbar=no,menubar=no,scrollbars=no,resizeable=yes,innerwidth=1920')
        }
    })
}

function insertUserDataIntoPopup(userData) {
    let fields = Object.keys(userData)
    for (let field of fields) {
        document.getElementById(`thq.user.${field}`).value = userData[field]
    }
}

function closePopup(e) {
    document.getElementById('thqPopup').style.visibility = 'hidden'
}

function openPopup(e) {
    let lastUNID = document.getElementById('thq.lastUNID')
    let UNID = e.target.getAttribute('data-for')
    let popup = document.getElementById('thqPopup')
    e.target.addEventListener('mousemove', movePopupWhileLoading)
    if (lastUNID.value !== UNID) {
        lastUNID.value = UNID
         // Get new details
         getUserDetails(UNID)
         .then((success) => {
             displayPopup()
         }, (failure) => {
             displayPopup()
         })
         .catch(err => {
             alert(err)
         })
    } else {
        displayPopup()
    }

    function displayPopup() {
            // Compensate for where the mouse moves to before the popup is shown
        popup.style.left = (e.layerX - 10) + 'px'
        popup.style.top = (e.layerY - 10) + 'px'
        popup.style.visibility = 'visible'
        popup.addEventListener('mouseleave', closePopup)
    }
}

function sendPWEmail(e) {
    let unid = document.getElementById('thq.lastUNID').value
    content.fetch(`${localServerAddress}/email?UNID=${unid}`)
    .then(res => {
        return res.json()
    })
    .then(message => {
        let alertDiv = document.getElementById('thq.alert')
        alertDiv.classList.remove('alert-danger')
        alertDiv.classList.add('alert-success')
        alertDiv.innerText = message.message
        alertDiv.style.display = 'block'        
        setTimeout(() => {
            alertDiv.style.display = 'none'
        }, 8000)
    })
    .catch(err => {
        let alertDiv = document.getElementById('thq.alert')
        alertDiv.classList.add('alert-danger')
        alertDiv.classList.remove('alert-success')
        alertDiv.innerText = err
        alertDiv.style.display = 'block'
        setTimeout(() => {
            alertDiv.style.display = 'none'
        }, 8000)
    })
}

function insertUsernamesIntoModal(responseData, err) {
    let usernameListInModal = document.getElementById('thqUsernameList')
    let infoButton = document.getElementById('queryInfo')
    usernameListInModal.innerHTML = '' // clear out existing usernames
    if (responseData.results === null || err || responseData.error) {
            let row = document.createElement('tr')
            let usernameCell = document.createElement('td')
            row.classList.add('list_row')
            usernameCell.setAttribute('colspan', '6')
            usernameCell.style.textAlign = 'center'
            if (err) {
                usernameCell.innerText = err
            } else if (responseData.error) {
                usernameCell.innerText = responseData.message
            } else {
                usernameCell.innerText = 'No usernames found'
            }
            row.appendChild(usernameCell)
            usernameListInModal.appendChild(row)
            document.getElementById('usernameLoader').style.display = 'none'
            document.getElementById('usernameTable').style.display = 'table'
            document.getElementById('thq.pagination').style.display = 'none'
            return void 0
    }
    document.getElementById('thq.total').value = responseData.queryCount
    document.getElementById('thq.offset').value = responseData.queryTo
    document.getElementById('thq.from').value = responseData.queryStart
    document.getElementById('thq.stats').innerText = responseData.queryStart + ' - ' + responseData.queryTo + ' of ' + responseData.queryCount
    if (responseData.queryTo === responseData.queryCount) {
        document.getElementById('thq.next').style.display = 'none'
    } else {
        document.getElementById('thq.next').style.display = 'inline-block'
    }

    if (responseData.queryStart === 1) {
        document.getElementById('thq.prev').style.display = 'none'
    } else {
        document.getElementById('thq.prev').style.display = 'inline-block'
    }
    infoButton.title = `Query Results: ${responseData.queryCount}  Requested: ${responseData.returnedCount} \n Statement: ${responseData.queryPhrase}`
    let odd = false // alternate row color
    // Construct the rows representing usernames
    responseData.results.forEach(username => {
            let row = document.createElement('tr')
            let usernameCell = document.createElement('td')
            let usernameSpan = document.createElement('span')
            let fullName = document.createElement('td')
            let nonsig = document.createElement('td')
            let nonsigSpan = document.createElement('span')
            let lastLogin = document.createElement('td')
            let admin = document.createElement('td')
            let info = document.createElement('td')
            let infoButton = document.createElement('button')
            infoButton.setAttribute('data-for', username.UNID)
            infoButton.classList.add('pointerhand', 'icon-info', 'btn', 'btn-icon')
            infoButton.addEventListener('mouseover', openPopup)
            info.appendChild(infoButton)

            row.classList.add('list_row')
            if (!odd) {
                row.classList.add('list_even')
                odd = true
            } else {
                row.classList.add('list_odd')
                odd = false
            }
            admin.innerText = username.userAdmin
            usernameSpan.innerText = `${username.username}`
            usernameSpan.classList.add('pseudo-link')
            usernameCell.innerHTML = `<input type="hidden" value="${username.UNID}"/>`
            nonsigSpan.innerText = removeLeadingZeros(username.nonsig)
            nonsig.appendChild(nonsigSpan)
            fullName.innerText = username.name
            lastLogin.innerText = username.lastLogin
            usernameSpan.addEventListener('click', sendUNIDToTHQ)
            usernameCell.appendChild(usernameSpan)
            row.appendChild(usernameCell)
            row.appendChild(fullName)
            row.appendChild(nonsig)
            row.appendChild(lastLogin)
            row.appendChild(admin)
            row.appendChild(info)
            usernameListInModal.appendChild(row)
    })
    document.getElementById('usernameLoader').style.display = 'none'
    document.getElementById('usernameTable').style.display = 'table'
    document.getElementById('thq.pagination').style.display = 'block'
}

function processTHQLogin(e) {
    if (e && e.keyCode && e.keyCode !== 13) {
        return void 0
    }

    let query = document.getElementById('thq.username').value
    let lastSearch = document.getElementById('thq.lastSearchPhrase')
    document.getElementById('thq.offset').value = 1

    if (query === lastSearch.value) {
        return
    } else {
        lastSearch.value = query
    }
    document.getElementById('usernameLoader').style.display = 'block'
    document.getElementById('usernameTable').style.display = 'none'
    content.fetch(`${localServerAddress}/search?q=${query}&resultCount=${maxResults}`)
    .then(response => {
        return response.json()
    })
    .then(data => {
        insertUsernamesIntoModal(data)
    })
    .catch(err => {
        insertUsernamesIntoModal(null, err)
        console.error(err)
    })
}

function getNthPage(e) {
    let movement = 0
    let query = document.getElementById('thq.username').value
    let lastSearch = document.getElementById('thq.lastSearchPhrase')
    let offset = parseInt(document.getElementById('thq.offset').value)
    let begin = parseInt(document.getElementById('thq.from').value)
    if (e.target && e.target.getAttribute('data-for')) {
        movement = parseInt(e.target.getAttribute('data-for'))
        if (isNaN(movement)) {
            movement = 1
        }
    }
    if (movement === -1) {
        offset = begin - maxResults < 0 ? 0 : begin - maxResults
    }

    if (query !== lastSearch.value) {
        processTHQLogin()
        return 0
    } else {
        lastSearch.value = query
    }
    document.getElementById('usernameLoader').style.display = 'block'
    document.getElementById('usernameTable').style.display = 'none'
    content.fetch(`${localServerAddress}/search?q=${query}&resultCount=${maxResults}&offset=${offset + 1}`)
    .then(response => {
        return response.json()
    })
    .then(data => {
        insertUsernamesIntoModal(data)
    })
    .catch(err => {
        insertUsernamesIntoModal(null, err)
        console.error(err)
    })
}

function createUsernameListModal() {
    var modalInnerHTML = `
    <div class="modal-dialog" role="dialog">
        <input id="thq.lastSearchPhrase" type="hidden">
        <input id="thq.total" type="hidden">
        <input id="thq.offset" type="hidden">
        <input id="thq.from" type="hidden">
        <div class="modal-content">
            <header class="modal-header">
                <button data-dismiss="modal" id="closeTHQModal" class="btn btn-icon close icon-cross">					
                    <span class="sr-only">Close</span>				
                </button>			
            <h4 id="attachment_title" class="modal-title">Search Usernames</h4>			
        </header>
        <div class="modal-body">
            <div class="row">
              <div class="col-10 my-3">
                    <div class="alert alert-danger" id="thq.alert" style="display:none;"></div>
                  <label onclick="return labelClicked(this);" id="label.thq.username" for="thq.username" dir="ltr" class=" col-xs-12 col-md-3 col-lg-4 control-label">
                    <span title="" class="label-text">
                      Search
                    </span>
                  </label>
                <div class="col-xs-10 col-sm-9 col-md-9 col-lg-8 form-field input_controls">
                  <input type="hidden" id="old.thq.username" name="old.thq.username">
                  <div class="input-group ref-container">
                    <input id="thq.username" name="thq.username" aria-labelledby="label.thq.username" type="text" autocorrect="off" class="form-control element_reference_input thq_search_function" disabled>
                    <div class="input-group-addon btn btn-primary thq_search_function" id="thq.selected.customer" style="display:none;" disabled>
                        Selected
                    </div>
                    <span class="input-group-btn">
                      <a class="btn btn-default thq_search_function" role="button" id="thqSearchButton" disabled>
                        <span class="icon icon-search" aria-hidden="true"></span>
                      </a>
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div class="row" style="margin-top: 20px;">
                <div class="lds-ring" id="usernameLoader" style="display:none"><div></div><div></div><div></div><div></div></div>
                <table class="data_list_table list_table table table-hover" id="usernameTable">
                    <thead>
                        <tr>
                            <th class="list_header_cell list_hdr" width="25%">Username</th>
                            <th class="list_header_cell list_hdr" width="15%">Full Name</th>
                            <th class="list_header_cell list_hdr" width="15%">Nonsig </th>
                            <th class="list-header_cell list_hdr" width="15%">Last Login</th>
                            <th class="list_header_cell list_hdr" width="10%">Admin</th>
                            <th class="text-align-right list_header_cell list_hdr" width="10%">Info </th>
                        </tr>
                    </thead>
                    <tbody class="list2_body" id="thqUsernameList">
                    </tbody>
                </table>
                <div id="thq.pagination">
                    <span class="btn btn-default" id="thq.prev" data-for="-1" style="margin-left: 10px">&lt;</span>
                    <span id="thq.stats" style="padding: 0 10px">0 - 0 of 0</span>
                    <span class="btn btn-default" id="thq.next" data-for="1">&gt;</span>
                </div>
            </div>
        </div>
            <div class="modal-footer">
                <button id="queryInfo" class="pointerhand icon-info btn btn-icon" style="padding:5px 5px;" type="button" title="" aria-expanded="false"></button>
                <button type="button" class="btn btn-secondary" data-dismiss="modal">Close</button>
            </div>
        </div>

        <div class="thq-popup panel" id="thqPopup">
        <form>
            <div class="form-row">
                <div class="form">
                    <input id="thq.lastUNID" type="hidden">
                    <div class="input-group-sm">
                        <label for="thq.user.username">Username</label>
                        <input type="text" id="thq.user.username" class="form-control" readonly>
                    </div>
            
                    <div class="input-group-sm">
                        <label for="thq.user.flName">Name</label>
                        <input type="text" id="thq.user.flName" class="form-control" readonly>
                    </div>
                    
                    <div class="input-group-sm">
                        <label for="thq.user.nonsig">Nonsig</label>
                        <input type="text" id="thq.user.nonsig" class="form-control" readonly>
                    </div>
            
                    <div class="input-group-sm">
                        <label for="thq.user.cown56">Common Owner</label>
                        <input type="text" id="thq.user.cown56" class="form-control" readonly>
                    </div>

                    <div class="input-group-sm">
                        <label for="thq.user.email">Email</label>
                        <input type="text" id="thq.user.email" class="form-control" readonly>
                    </div>

                    <div class="input-group-sm">
                        <label for="thq.user.userAdmin">User Admin</label>
                        <input type="text" id="thq.user.userAdmin" class="form-control" readonly>
                    </div>
                    <button type="button" class="btn btn-primary btn-block" style="margin-top: 1em;" id="thq.passwordReset">Send Password</button>
                </div>
            </div>
        </form>
    </div>
    </div>`

    var modal = document.createElement('div')
    modal.classList.add('modal')
    modal.classList.add('fade')
    modal.id = 'thqUsernameListModal'
    modal.setAttribute('name', 'thqUsernameListModal')    
    modal.setAttribute('tabindex', '-1')
    modal.setAttribute('role', 'dialog')
    modal.setAttribute('aria-labelledby', 'thqUsernameListModalLabel')
    modal.setAttribute('aria-hidden', 'true')
    // modal.style.zIndex = '1060'
    modal.innerHTML = modalInnerHTML
    document.querySelector('body').appendChild(modal)
    document.getElementById('thq.selected.customer').addEventListener('click', searchSelectedCustomer)
    document.getElementById('thqSearchButton').addEventListener('click', processTHQLogin)
    document.getElementById('thq.username').addEventListener('keyup', processTHQLogin)
    document.getElementById('thq.passwordReset').addEventListener('click', sendPWEmail)
    document.getElementById('thq.next').addEventListener('click', getNthPage)
    document.getElementById('thq.prev').addEventListener('click', getNthPage)
    content.fetch(`${localServerAddress}/isActive`, {
        method: "POST"
    })
    .then(res => {
        return res.json()
    })
    .then(data => {
        if (data.message) {
            activateTHQSearchInputs()
        }
    })

    // Activate the input field and search button if lotus notes is initialized
    function activateTHQSearchInputs() {
        for (let input of document.querySelectorAll('.thq_search_function')) {
            input.removeAttribute('disabled')
        }
    }
}

function processTHQLogin(e) {
    if (e.keyCode && e.keyCode !== 13) {
        return void 0
    }

    let query = document.getElementById('thq.username').value
    let lastSearch = document.getElementById("thq.lastSearchPhrase")
   
    if (query === lastSearch.value) {
        return
    } else {
        lastSearch.value = query
    }
    console.log(query)
    document.getElementById('usernameLoader').style.display = 'block'
    document.getElementById('usernameTable').style.display = 'none'
    document.getElementById('thq.pagination').style.display = 'none'
    content.fetch(`${localServerAddress}/search?q=${query}&resultCount=${maxResults}`)
    .then(response => {
        return response.json()
    })
    .then(data => {
        document.getElementById('thq.alert').style.display = 'none'
        insertUsernamesIntoModal(data)
    })
    .catch(err => {
        document.getElementById('thq.alert').style.display = 'block'
        document.getElementById('thq.alert').innerText = err
        insertUsernamesIntoModal(null, err)
        console.error(err)
    })
}

function getPrintDetails() {
    try {
        const TICKET_NUMBER = document.getElementById('element.incident.number')
        const TICKET_COL_1 = TICKET_NUMBER.parentElement
        const TICKET_COL_2 = TICKET_COL_1.nextElementSibling
        const SHORT_DESCRIPTION = document.getElementById('incident.short_description')
        const DESCRIPTION = document.getElementById('incident.description')
        const RESOLUTION_NOTES = document.getElementById('incident.close_notes')
        const RESOLUTION_CODE = document.getElementById('incident.close_code')
        const WORK_HISTORY = []
        document.querySelectorAll('.h-card').forEach(card => {
            if (card.children.length < 3) return
            const name = card.children[0].querySelector('.sn-card-component-createdby').innerText
            const type = card.children[1].querySelector('.sn-card-component-time').innerText
            const data = card.children[2].innerText
            if (name !== 'system' && (type.startsWith('Additional') || type.startsWith('Work notes'))) {
                WORK_HISTORY.push({
                    author: name,
                    info: type,
                    data
                })
            }
        })
    } catch(err) {
        alert('Error creating print export')
    }
}

function handleOnLoad() {
    var jsFinishTimer = setInterval(checkForFinishedLoadingJS, 50)
    var counter = 0
    function checkForFinishedLoadingJS() {
        if (document.getElementById(navHeader) != null && counter < 10) {
            clearInterval(jsFinishTimer)
            chrome.storage.local.get(['thqLoginEnabled', 'serverAddr', 'resultCount'], function(fields) {
                if (fields.thqLoginEnabled) {
					// Create the Tire-HQ Button in the nav bar
                    createActionButton({
                        newEl: 'thqLogin',
                        innerText: 'Tire-HQ',
                        listenOn: 'click',
                        eventHandler: enableSelectedButtonIfCustomerSelected
                    })
					// Let bootstrap toggle the modal
                    document.getElementById('thqLogin').setAttribute('data-toggle', 'modal')
                    document.getElementById('thqLogin').setAttribute('data-target', '#thqUsernameListModal')
                    if (fields.serverAddr) {
                        localServerAddress = fields.serverAddr
                    } else {
						// Default
                        localServerAddress = 'http://localhost:8080'
                    }

                    if (fields.resultCount) {
                        maxResults = fields.resultCount
                    } // else default to 15
                    createUsernameListModal()
                }
                if (document.getElementById(callerIdField).readOnly) {
					// Ticket that is open is an already opened ticket
					checkForFirstCallClose()
				} else {
                    // Ticket open is a new ticket
                    window.addEventListener('keyup', function(e) {
                        if (e.keyCode === 90 && e.shiftKey && e.ctrlKey) {
                            e.preventDefault()
                            firstCallClose()
                        }
                    })
					createActionButton({
						newEl: 'sysverb_insert_and_close',
						innerText: 'Close',
						listenOn: 'click',
						eventHandler: firstCallClose
					})
				}
            })
        } else if (counter > 10) {
            console.log('Page did not load')
            clearInterval(jsFinishTimer)
        } else {
            console.log('Counter is increasing to ' + counter)
            counter++
        }
    }
}

chrome.storage.local.get(['enabledHosts'], function(fields) {
    // Check to see if it is enabled for this host
    if (fields.enabledHosts && fields.enabledHosts[window.location.host]) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', handleOnLoad)
        } else {
            handleOnLoad()
        }
    }
})