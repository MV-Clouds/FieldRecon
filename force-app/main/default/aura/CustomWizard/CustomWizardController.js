({
    init: function (component, event, helper) {
        var deviceName = $A.get('$Browser.formFactor');
        component.set('v.deviceType', deviceName);

        component.set('v.steps', [
            { label: 'Step1', value: 'step1' },
            { label: 'Step2', value: 'step2' }
        ]);

        helper.fetchUserRole(component, event, helper);
        helper.fetchUserLicense(component, event, helper);
        helper.fetchProfile(component, event, helper);
        helper.fetchTime(component, event, helper);
        helper.fetchLocale(component, event, helper);
        helper.fetchLanguage(component, event, helper);
        helper.fetchEmailEncoding(component, event, helper);
        helper.doInitHelper(component, event, helper);
        helper.customReimbursement(component, event, helper);
        helper.getDefaultValues(component, event, helper);
        helper.fetchOrgTimeZone(component, event, helper);
    },

    Save_MaxIndicatorDistance_StartWeekDay: function (component, event, helper) {
        var defalutValues = component.get('v.DefalutValues');
        if (
            $A.util.isUndefined(defalutValues.maxIndicatorDistance) ||
            $A.util.isEmpty(defalutValues.maxIndicatorDistance) ||
            $A.util.isEmpty(defalutValues.weekStartDay)
        ) {
            helper.toast.error('Please insert valid value');
        } else {
            helper.saveDefaultValues(component, event, helper);
        }
    },

    abc: function (component, event, helper) {
        component.find('overlayLib').showCustomPopover({
            body: modalBody,
            referenceSelector: '.mypopover',
            cssClass: 'slds-nubbin_right,no-pointer'
        });
    },

    /* getLocale: function (component, event, helper) {
        helper.passLocaleValue(component, event, helper);
    }, */

    getUserLocale: function (component, event, helper) {
        helper.passUserLocalValue(component, event, helper);
    },

    /* getLanguage: function (component, event, helper) {
        helper.passLanguageValue(component, event, helper);
    }, */

    getUserLanguage: function (component, event, helper) {
        helper.passUserLanguageValue(component, event, helper);
    },

    /* getTimeZone: function (component, event, helper) {
        helper.passTimeZoneValue(component, event, helper);
    }, */

    getUserTimeZone: function (component, event, helper) {
        helper.passUserTimeZoneValue(component, event, helper);
    },

    getRole: function (component, event, helper) {
        helper.passRoleValue(component, event, helper);
    },

    getUserLicense: function (component, event, helper) {
        helper.passULValue(component, event, helper);
    },

    getProfile: function (component, event, helper) {
        helper.passProfileValue(component, event, helper);
    },

    onCheck: function (cmp, evt) {
        var checkCmp = cmp.find('checkbox');
        resultCmp = cmp.find('checkResult');
        resultCmp.set('v.value', '' + checkCmp.get('v.value'));
    },

    getEmailEncoding: function (component, event, helper) {
        helper.passEmailEncodingValue(component, event, helper);
    },

    SearchUser: function (component, event, helper) {
        var term = event.getSource().get('v.value');
        var searchField = 'name';

        var UserList = component.get('v.listOfAllUsersMain');
        for (var i = 0; i < UserList.length; i++) {
            if (term != null && term != '') {
                UserList = helper.filterProcess(component, event, helper, UserList, term, searchField);

                helper.setPagination(component, event, helper, UserList);
            } else {
                helper.setPagination(component, event, helper, component.get('v.listOfAllUsersMain'));
            }
        }
    },

    getActiveUser: function (component, event, helper) {
        component.set('v.listOfAllUsers', component.get('v.listOfAllUsersMain'));
        var term = component.get('v.selectedUser');

        var searchField = 'active';
        if (term == 'active') {
            term = true;
        } else if (term == 'inactive') {
            term = false;
        }
        var UserList = component.get('v.listOfAllUsers');

        for (var i = 0; i < UserList.length; i++) {
            if (term == false || term == true) {
                UserList = helper.filterProcess(component, event, helper, UserList, term, searchField);
                helper.setPagination(component, event, helper, UserList);
            } else {
                helper.setPagination(component, event, helper, component.get('v.listOfAllUsersMain'));
            }
        }
    },

    handleClickNext: function (component, event, helper) {
        component.set('v.showSpinner', true);
        var selectedStep = event.getSource().get('v.value');
        var nextStep = selectedStep == 'Step1' ? 'Step2' : 'finished';

        if (nextStep == 'finished') {
            component.set('v.finished', nextStep);
        } else {
            console.log(nextStep);
            component.set('v.currentStep', nextStep);
            component.set('v.showSpinner', false);
        }
    },
    handleClickPrevious: function (component, event, helper) {
        var selectedStep = event.getSource().get('v.value');
        var nextStep = selectedStep == 'Step2' ? 'Step1' : 'finished';
        $A.get('e.force:refreshView').fire();
    },

    handlePrevious: function (component, event, helper) {
        var selectedStep = event.getSource().get('v.value');
        var nextStep = selectedStep == 'Step2' ? 'Step1' : 'finished';

        if (nextStep == 'finished') {
            component.set('v.finished', nextStep);
        } else {
            component.set('v.currentStep', nextStep);
        }
    },

    handleUserProgressBar: function (component, event, helper) {
        var selectedStep1 = event.getSource().get('v.value');
        var nextStep = 'Step1';

        if (nextStep == 'finished') {
            component.set('v.finished', nextStep);
        } else {
            component.set('v.currentStep', nextStep);
        }
    },

    handleSchedulerProgressBar: function (component, event, helper) {
        component.set('v.showSpinner', true);

        var selectedStep = event.getSource().get('v.value');
        var nextStep = 'Step1';

        window.setTimeout(
            $A.getCallback(function () {
                component.set('v.showSpinner', false);
            }),
            3000
        );

        if (nextStep == 'finished') {
            component.set('v.finished', nextStep);
        } else {
            component.set('v.currentStep', nextStep);
        }
    },

    handleSDefaultProgressBar: function (component, event, helper) {
        var selectedStep = event.getSource().get('v.value');
        component.set('v.showSpinner', true);
        var nextStep = 'Step2';

        if (nextStep == 'finished') {
            component.set('v.finished', nextStep);
        } else {
            component.set('v.currentStep', nextStep);
            component.set('v.showSpinner', false);
        }
    },

    handleDefaultValue: function (component, event, helper) {
        component.set('v.showSpinner', true);
        var selectedStep = event.getSource().get('v.value');
        var nextStep = selectedStep == 'Step1' ? 'Step2' : 'finished';

        if (nextStep == 'finished') {
            component.set('v.finished', nextStep);
        } else {
            component.set('v.currentStep', nextStep);
            component.set('v.showSpinner', false);
        }
    },

    handleDefaultPrevious: function (component, event, helper) {
        var selectedStep = event.getSource().get('v.value');
        var nextStep = selectedStep == 'Step2' ? 'Step1' : 'finished';

        if (nextStep == 'finished') {
            component.set('v.finished', nextStep);
        } else {
            component.set('v.currentStep', nextStep);
        }
    },

    handleUserDetail: function (component, event, helper) {
        helper.saveUserDetail(component, event, helper);
    },

    handleclickUser: function (component, event, helper) {
        helper.fetchbasicUserDetail(component, event, helper);
    },

    handleclickEdit: function (component, event, helper) {
        helper.fetchUserAllDetail(component, event, helper);
    },

    inActive: function (component, event, helper) {
        component.set('v.showSpinner', true);
        helper.inActivateUser(component, event, helper);
        component.set('v.showSpinner', false);
    },

    selectAllCheckbox: function (component, event, helper) {
        var selectedHeaderCheck = event.getSource().get('v.value');
        var updatedAllRecords = [];
        var listOfAllUser = component.get('v.listOfAllUsers');
        // play a for loop on all records list
        for (var i = 0; i < listOfAllUser.length; i++) {
            // check if header checkbox is 'true' then update all checkbox with true and update selected records count
            // else update all records with false and set selectedCount with 0
            if (selectedHeaderCheck == true) {
                listOfAllAccounts[i].isChecked = true;
                component.set('v.selectedCount', listOfAllUser.length);
            } else {
                listOfAllAccounts[i].isChecked = false;
                component.set('v.selectedCount', 0);
            }
            updatedAllRecords.push(listOfAllUser[i]);
        }

        component.set('v.listOfAllUsers', updatedAllRecords);
    },

    handleDefaultValueSave: function (component, event, helper) {
        helper.reimbursementData(component, event, helper);
    },

    handleFilesChange: function (component, event, helper) {
        var fileName = 'No File Selected..';
        if (event.getSource().get('v.files').length > 0) {
            fileName = event.getSource().get('v.files')[0]['name'];
        }

        component.set('v.pictureSrc', fileName);
    },

    resetPassword: function (component, event, helper) {
        helper.resetUserPassword(component, event, helper);
    },

    aliasWrite: function (component, event, helper) {
        var temp =
            component.get('v.userDetail.lastName').charAt(0) + component.get('v.userDetail.firstName').substring(0, 5);
        component.set('v.userDetail.alias', temp);
    },

    userWrite: function (component, event, helper) {
        component.set('v.userDetail.uname', component.get('v.userDetail.email'));
    },

    nicknameWrite: function (component, event, helper) {
        var temp = component.get('v.userDetail.firstName') + component.get('v.userDetail.lastName');
        component.set('v.userDetail.communityNickname', temp);
    },

    openModelForPasswword: function (component, event, helper) {
        // Set isModalOpen attribute to true
        component.set('v.isUserModalOpen', true);
    },
    openModelForPasswword: function (component, event, helper) {
        // Set isModalOpen attribute to true
        component.set('v.isUserModalOpen', false);
    },

    openModelForUserDetials: function (component, event, helper) {
        // Set isModalOpen attribute to true
        var profiles = Object.values(component.get('v.listOfAllUserProfile'));

        component.set('v.userDetail.firstName', '');

        component.set('v.userDetail.profileId', profiles[0].id);
        component.set('v.userDetail.emailEncodingKey', 'ISO-8859-1');
        component.set('v.isUserModalOpen', true);
    },

    closeModelForUserDetials: function (component, event, helper) {
        // Set isModalOpen attribute to false
        component.set('v.isUserModalOpen', false);
    },

    openModel: function (component, event, helper) {
        // Set isModalOpen attribute to true
        var profiles = Object.values(component.get('v.listOfAllUserProfile'));

        component.set('v.userDetail.firstName', '');
        component.set('v.userDetail.lastName', '');
        component.set('v.userDetail.email', '');
        component.set('v.userDetail.phone', '');
        component.set('v.userDetail.userRoleId', '');
        component.set('v.userDetail.communityNickname', '');
        component.set('v.userDetail.alias', '');
        component.set('v.userDetail.emailEncodingKey', '');
        component.set('v.userDetail.crewUser', true);
        component.set('v.userDetail.uname', '');

        component.set('v.userDetail.profileId', profiles[0].id);
        component.set('v.userDetail.emailEncodingKey', 'ISO-8859-1');
        component.set('v.userDetail.timezone', component.get('v.orgTimeZone'));
        component.set('v.userDetail.locale', component.get('v.orgLocale'));
        component.set('v.userDetail.languageLocale', component.get('v.orgLan'));
        component.set('v.isModalOpen', true);
    },

    closeModel: function (component, event, helper) {
        // Set isModalOpen attribute to false
        component.set('v.isModalOpen', false);
        component.set('v.userDetail.firstName', '');
        component.set('v.userDetail.lastName', '');
        component.set('v.userDetail.email', '');
        component.set('v.userDetail.phone', '');
        component.set('v.userDetail.profileId', '');
        component.set('v.userDetail.userRoleId', '');
        component.set('v.userDetail.communityNickname', '');
        component.set('v.userDetail.alias', '');
        component.set('v.userDetail.uname', '');
    },

    submitDetails: function (component, event, helper) {
        // Set isModalOpen attribute to false
        //Add your code to call apex method or do some processing
        component.set('v.isModalOpen', false);
    },

    show: function (component, event, helper) {
        component.set('v.Spinner', false);
    },

    hide: function (component, event, helper) {
        component.set('v.Spinner', true);
    },
    searchKeyChange: function (component, event) {
        var searchKey = component.find('searchKey').get('v.value');

        var action = component.get('c.findByName');
        action.setParams({
            searchKey: searchKey
        });
        action.setCallback(this, function (a) {
            component.set('v.accounts', a.getReturnValue());
        });
        $A.enqueueAction(action);
    },

    nextPageRecord: function (component, event, helper) {
        var pageNumber = component.get('v.pageNumber');
        component.set('v.pageNumber', pageNumber + 1);
        helper.pageRecord(component, event, helper);
    },

    prevPageRecord: function (component, event, helper) {
        var pageNumber = component.get('v.pageNumber');
        component.set('v.pageNumber', pageNumber - 1);
        helper.pageRecord(component, event, helper);
    }
});