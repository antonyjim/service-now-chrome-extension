// Global server address variable, set in handleOnLoad
let serverAddr = null

/**
 * Create assignment group fields from the assignment groups in local storage.
 * @param {Array<{GROUPNAME: SYSID}>} groups Array of groups with their respective sys_id
 * @param {String} selectedGroup Sys id of user's group
 */
function createAssignmentGroups(groups, selectedGroup) {
    let elToInsertBefore = document.getElementById("addAssignmentGroup")
    let selectAssignmentGroup = document.getElementById("assignmentGroupsToChooseFrom")
    let usersGroup = document.getElementById('assignmentGroupsToChooseFrom')
    Object.keys(groups).forEach(function(group) {
        let div = document.createElement('div')
        let opt = document.createElement('option')
        let assignmentGroupName = document.createElement('input')
        let assignmentGroupSysId = document.createElement('input')
        assignmentGroupName.type = 'text'
        assignmentGroupSysId.type = 'text'
        assignmentGroupName.setAttribute('data-for', 'name')
        assignmentGroupSysId.setAttribute('data-for', 'sys')
        assignmentGroupName.value = group
        assignmentGroupSysId.value = groups[group]
        opt.innerText = group
        opt.value = groups[group]
        div.setAttribute('data-fields', 'assignmentGroups')
        div.appendChild(assignmentGroupName)
        div.appendChild(assignmentGroupSysId)
        div.classList.add('inline-inputs')
        selectAssignmentGroup.appendChild(opt)
        elToInsertBefore.parentElement.insertBefore(div, elToInsertBefore)
    })
    if (selectedGroup) {
        usersGroup.value = selectedGroup.sys
    }
}

/**
 * When the user clicks on new assignment group, create 2 new
 * input fields for sys_id and name.
 * @param {Event} e Click event
 */
function createNewAssignmentGroupInputFields(e) {
    let div = document.createElement('div')
    let assignmentGroupName = document.createElement('input')
    let assignmentGroupSysId = document.createElement('input')
    assignmentGroupName.type = 'text'
    assignmentGroupSysId.type = 'text'
    assignmentGroupName.setAttribute('data-for', 'name')
    assignmentGroupSysId.setAttribute('data-for', 'sys')
    div.setAttribute('data-fields', 'assignmentGroups')
    div.appendChild(assignmentGroupName)
    div.appendChild(assignmentGroupSysId)
    div.classList.add('inline-inputs')
    e.target.parentElement.insertBefore(div, e.target)
}

/**
 * Toggle the selected tab in the popup interface.
 * @param {Event} e Click event
 */
function selectOptionsTab(e) {
    let tabToBe = document.getElementById(e.target.getAttribute('data-for'))
    if (tabToBe === null) {
        return;
    } else {
        document.querySelectorAll('.tabbed-ui-tab').forEach(function(tab) {
            if (tab.classList.contains('active')) {
                tab.classList.remove('active')
                document.getElementById(tab.getAttribute('data-for')).classList.remove('active')
            }
        })
        e.target.classList.add('active')
        tabToBe.classList.add('active')
    }
}

/**
 * Set the assignment group information in chrome.storage.local
 */
function updateAssignmentGroups() {
    let names = document.querySelectorAll('div[data-fields=assignmentGroups] input[data-for=name]')
    let sys = document.querySelectorAll('div[data-fields=assignmentGroups] input[data-for=sys]')
    let groups = {}
    for (let assignmentGroup in names) {
        if (names[assignmentGroup].value) {
            groups[names[assignmentGroup].value] = sys[assignmentGroup].value
        } else {
            continue;
        }

    }
    chrome.storage.local.set({'assignmentGroups': groups})
}

function updateIndividualAssignmentGroup() {
    let assnGrp = document.getElementById("assignmentGroupsToChooseFrom")
    let groupSys = assnGrp.value
    let groupName = assnGrp.children[assnGrp.selectedIndex].innerText
    chrome.storage.local.set({
        usersAssignmentGroup: {
            name: groupName,
            sys: groupSys
        }
    })
}

function toggleHosts(e) {
    let enabledHosts = {}
    document.querySelectorAll('.enable').forEach(function(checkbox) {
        if (checkbox.checked) {
            enabledHosts[checkbox.id] = true
        } else {
            enabledHosts[checkbox.id] = false
        }
    })
    chrome.storage.local.set({enabledHosts})
}

function insertDefaultFields() {
    chrome.storage.local.get(['defaultSelections'], function(fields) {
        if (fields.defaultSelections) {
            if (fields.defaultSelections) {
                for (let defaultField of fields.defaultSelections) {
                    createNewDefaultFieldInputGroup(null, defaultField.el, defaultField.selected)
                    openFields.push(defaultField.el)
                }
            } else {
                createNewDefaultFieldInputGroup()
            }
        }
    })
}

function insertOptionsForSelectedField(e) {
    let index = e.target.selectedIndex
    index--
    fetch('/options.json')
    .then(res => {
        return res.json()
    })
    .then(options => {
        if (options) {
            if (e.target.parentElement.children[1]) {
                e.target.parentElement.removeChild(e.target.parentElement.children[1])
            }
            let val = options[index]
            let inputField = document.createElement(val.inputType)
            inputField.setAttribute('data-for', 'fieldSelected')
            if (val.options) {
                for (let opt of val.options) {
                    let option = document.createElement('option')
                    option.value = opt.value
                    option.innerText = opt.friendlyName
                    inputField.appendChild(option)
                }
            }
            if (e.target.getAttribute('data-selected')) {
                inputField.value = e.target.getAttribute('data-selected')
            }
            e.target.parentElement.appendChild(inputField)
        } else {
            throw new Error('No fields')
        }
    })
    .catch(err => {
        alert(err)
    })
}

function submitForm(e) {
    if ((e.keyCode && e.keyCode === 13) || e.target.id === 'initialize') {

        let pw = document.getElementById('lnPassword').value
        fetch(`${serverAddr}/initialize?Pw=${btoa(pw)}`)
        .then(response => {
            return response.json()
        })
        .then(data => {
            if (data.error) {
                document.getElementById('lnPassword').removeAttribute('readonly')
                document.getElementById('initialize').removeAttribute('disabled')
                document.getElementById('isLNReady').innerText = data.message
            } else {
                document.getElementById('lnPassword').setAttribute('readonly', 'readonly')
                document.getElementById('initialize').style.display = 'none'
                document.getElementById('isLNReady').innerText = data.message
            }
        })
        .catch(err => {
            alert(err)
        })
    }
}

function stopServer() {
    fetch(`${serverAddr}/exit`)
    .catch(err => {
        document.getElementById('isLNReady').value = 'Successfully stopped'
    })
}

function testLNSession() {
    let statusSpan = document.getElementById('isLNReady')
    let pwBox = document.getElementById('lnPassword')
    fetch(`${serverAddr}/isActive`, {
        method: "POST"
    })
    .then(response => {
        return response.json()
    })
    .then(data => {
        if (data.message === true) {
            statusSpan.innerText = 'Lotus Notes is ready'
            document.getElementById('initialize').style.display = 'none'
            pwBox.value = 'password'
            pwBox.setAttribute('readonly', 'true')
        } else {
            statusSpan.innerText = 'Lotus Notes is not ready'
            pwBox.removeAttribute('readonly')
            pwBox.value = ''
        }
    })
    .catch(err => {
        statusSpan.innerText = 'Web server is not running'
        pwBox.setAttribute('readonly', 'true')
        pwBox.value = 'password'
    })
}

function disableAccessRequest(token) {
    document.getElementById('searchTokenRequest').style.display = 'none'
    document.getElementById('searchTokenStatus').innerHTML = ''
    document.getElementById('searchToken').value = token
}

function enableAccessRequest() {
    document.getElementById('searchTokenRequest').style.display = 'inline-block'
    document.getElementById('searchTokenStatus').innerText = 'No token found. Please enter your name below and click "Request Token"'
}

function requestSearchToken() {
    const name = document.getElementById('searchToken').value
    if (!name) {
        document.getElementById('searchTokenStatus').innerText = 'Name cannot be blank. Please enter your name below'
    } else {
        chrome.storage.local.get(['searchTokenUrl'], (fields) => {
            if (fields.searchTokenUrl) {
                fetch('https://' + fields.searchTokenUrl + '/requestToken?name=' + name, {
                    method: 'GET',
                    mode: 'cors'
                })
                .then(res => {
                    if (res.ok) {
                        return res.json()
                    } else {
                        throw new Error('Could not request token')
                    }
                })
                .then(token => {
                    if (token.token) {
                        chrome.storage.local.set({searchToken: token.token})
                        document.getElementById('searchToken').value = token.token
                    } else {
                        throw new Error('Request token retrieval failed')
                    }
                })
                .catch(err => {
                    console.error(err)
                    document.getElementById('searchTokenStatus').innerText = err.message
                })
            } else {
                document.getElementById('searchTokenStatus').innerText = 'Token request url not set.'
            }
        })

    }
}

function setSearchTokenUrl(e) {
    const tokenHost = document.getElementById('searchTokenUrl').value
    if (!tokenHost) return
    chrome.storage.local.set({searchTokenUrl: tokenHost})
    e.target.style.background = 'green'
}

function createNewDefaultFieldInputGroup(e, selectedVal, selectedIndex) {
    fetch('/fields.json')
    .then(res => {
        return res.json()
    })
    .then(fields => {
        if (fields) {
            if (fields.length == document.querySelectorAll('div[data-fields=defaultField]').length - 1) {
                document.getElementById('addDefaultField').setAttribute('disabled', 'disabled')
                return;
            }
            let parent = document.getElementById("addDefaultField")
            let div = document.createElement('div')
            let inputName = document.createElement('select')
            inputName.setAttribute('data-for', 'fieldName')
            div.setAttribute('data-fields', 'defaultField')
            div.appendChild(inputName)
            div.classList.add('inline-inputs')
            for (let option of fields) {
                let opt = document.createElement('option')
                opt.value = option.el
                opt.innerText = option.friendlyName
                inputName.appendChild(opt)
            }
            inputName.addEventListener('change', insertOptionsForSelectedField)
            parent.parentElement.insertBefore(div, parent)
            if (selectedVal) {
                inputName.value = selectedVal
                inputName.setAttribute('data-selected', selectedIndex)
                inputName.dispatchEvent(new Event('change'))
            }
        } else {
            throw new Error('Missing fields')
        }

    })
    .catch(err => {
        alert(err)
    })
}

function updateDefaultFieldSelections(e) {
    // Since all default input selections are within a div with the data-fields="defaultField" attr,
    // loop through all of these divs and put the value of the nested inputs into the defaultFields
    // variable to store in the defaultSelections of chrome.storage.local area.
    let defaultFieldInputGroups = document.querySelectorAll('div[data-fields=defaultField]')
    let defaultFields = []
    for (let defaultFieldInputGroup of defaultFieldInputGroups) {
        let el = defaultFieldInputGroup.querySelector('select[data-for=fieldName]').value
        let selected = defaultFieldInputGroup.querySelector('[data-for=fieldSelected]').value
        if (el && selected) {
            let opts = {
                el,
                selected
            }
            defaultFields.push(opts)
        } else {
            continue;
        }
    }
    chrome.storage.local.set({defaultSelections: defaultFields})
    e.target.style.background = 'green'
}

function selectEnabledCheckBoxes() {
    // Check the enabled hosts
    chrome.storage.local.get(['enabledHosts'], function(fields) {
        if (fields.enabledHosts) {
            for(let host of Object.keys(fields.enabledHosts)) {
                if (fields.enabledHosts[host]) {
                     document.getElementById(host).checked = true           
                }
            }
        }
    })
}

function setNewTabBehavior(e) {
    let newTabHref = e.target.value
    chrome.storage.local.set({newTabHref})
}

function toggleTHQ(e) {
    chrome.storage.local.set({thqLoginEnabled: e.target.checked})
    document.getElementById('thqTab').style.display = e.target.checked ? '' : 'none'
}

function setVal(e) {
    if (e.keyCode === 13 && e.target.value) {
        let obj = {}
        if (e.target.id === 'resultCount') {
            obj[e.target.id] = !isNaN(parseInt(e.target.value))? parseInt(e.target.value) : 15
        } else {
            obj[e.target.id] = e.target.value            
        }
        chrome.storage.local.set(obj)
    } else if (e.target.type == 'checkbox') {
        let obj = {}
        obj[e.target.id] = e.target.checked
        chrome.storage.local.set(obj)
    }
}

function toggleTabBehavior(ovr) {
    const tabsEnabled = document.getElementById('tabsEnabled')
    if (tabsEnabled.checked || ovr) {
        document.getElementById('newTabBehavior').removeAttribute('disabled')
    } else {
        document.getElementById('newTabBehavior').setAttribute('disabled', 'disabled')
    }
}

function readFile() {
    const files = document.getElementById('userList')
    const errorAlert = document.getElementById('fileUploadError')
    if (files.files && files.files.length > 0) {
        try {
            errorAlert.style.display = 'none'
            const reader = new FileReader()
            reader.onload = function(e) {
                const users = JSON.parse(e.target.result)
                chrome.storage.local.set({users})
                populateUserList(users)
            }
            reader.readAsText(files.files[0])
        } catch(err) {
            errorAlert.style.display = 'block'
        }
    }
}

function handleOnLoad() {
    chrome.storage.local.get([
            'assignmentGroups',  
            'usersAssignmentGroup',
            'newTabHref',
            'thqLoginEnabled',
            'resultCount',
            'serverAddr',
            'hideSuggestions',
            'tabsEnabled',
            'users',
            'searchToken',
            'searchTokenUrl'
        ], function(fields) {

        if (fields.assignmentGroups) {
            createAssignmentGroups(fields.assignmentGroups, fields.usersAssignmentGroup)
        }
        if (fields.newTabHref) {
            document.getElementById('newTabBehavior').value = fields.newTabHref
        }
        if (fields.thqLoginEnabled) {
            document.getElementById('thqLoginEnabled').checked = true
            document.getElementById('THQLoginEnabled').checked = true
            document.getElementById('thqTab').style.display = ''
        }

        if (fields.serverAddr) {
            document.getElementById('serverAddr').value = fields.serverAddr
            serverAddr = fields.serverAddr
            testLNSession()
        }

        if (fields.resultCount) {
            document.getElementById('resultCount').value = fields.resultCount
        }

        if (fields.hideSuggestions) {
            document.getElementById('hideSuggestions').checked = true
        }
        if (fields.tabsEnabled) {
            document.getElementById('tabsEnabled').checked = true
            toggleTabBehavior(true)
        }
   })

    insertDefaultFields()
    selectEnabledCheckBoxes()
    document.querySelectorAll('.tabbed-ui-tab').forEach(function(tab) {
        tab.addEventListener('click', selectOptionsTab, true)
    })
    document.querySelectorAll('.enable').forEach(function(toggleSwitch) {
        toggleSwitch.addEventListener('click', toggleHosts, true)
    })
    document.getElementById('addAssignmentGroup').addEventListener('click', createNewAssignmentGroupInputFields, true)
    document.getElementById('updateAssignmentGroups').addEventListener('click', updateAssignmentGroups, true)
    document.getElementById("assignmentGroupsToChooseFrom").addEventListener('change', updateIndividualAssignmentGroup, true)
    document.getElementById('addDefaultField').addEventListener('click', createNewDefaultFieldInputGroup, true)
    document.getElementById('updateDefaultFields').addEventListener('click', updateDefaultFieldSelections, true)
    document.getElementById('newTabBehavior').addEventListener('change', setNewTabBehavior, true)
    document.getElementById('thqLoginEnabled').addEventListener('change', toggleTHQ, true)
    document.getElementById('THQLoginEnabled').addEventListener('change', toggleTHQ, true)
    document.getElementById('lnPassword').addEventListener('keyup', submitForm, true)
    document.getElementById('stopServer').addEventListener('click', stopServer, true)
    document.getElementById('initialize').addEventListener('click', submitForm, true)
    document.getElementById('serverAddr').addEventListener('keyup', testLNSession, true)
    document.getElementById('serverAddr').addEventListener('keyup', setVal, true)
    document.getElementById('resultCount').addEventListener('keyup', setVal, true)
    document.getElementById('tabsEnabled').addEventListener('change', toggleTabBehavior, true)
    document.querySelectorAll('input[type=checkbox].toggle').forEach(input => {
        input.addEventListener('change', setVal)
    })
}

let openFields = []
let allFields = []
if (document.readystate === 'loading') {
    document.addEventListener('DOMContentReady', handleOnLoad)
} else {
    handleOnLoad()
}