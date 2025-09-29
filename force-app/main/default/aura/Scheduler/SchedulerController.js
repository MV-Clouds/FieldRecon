({
    doInit: function (component, event, helper) {
        var deviceName = $A.get('$Browser.formFactor');
        component.set('v.deviceType', deviceName);

        helper.checkAccess(component, event, helper);
        helper.StartWaiting(component, event, helper);
        helper.SetDefaults(component, event, helper);

        var today = new Date();

        var fromDate = today.getFullYear() + '-' + (today.getMonth() + 1) + '-' + today.getDate();
        var fromDateString = fromDate.split('-');

        if (fromDateString[1].length == 1) {
            fromDateString[1] = '0' + fromDateString[1];
        }
        if (fromDateString[2].length == 1) {
            fromDateString[2] = '0' + fromDateString[2];
        }
        fromDate = fromDateString[0] + '-' + fromDateString[1] + '-' + fromDateString[2];

        component.set('v.fromDate', fromDate);
        component.set('v.isInitializing', false);
        component.set('v.toDate', today.getFullYear() + '-' + (today.getMonth() + 1) + '-' + today.getDate());

        if (deviceName == 'DESKTOP') {
            today.setDate(today.getDate() + 7);

            component.set('v.toDate', today.getFullYear() + '-' + (today.getMonth() + 1) + '-' + today.getDate());
        }

        helper.IsDesktopOrPhone(component, event, helper);
    },

    handleTouchMove: function (component, event, helper) {
        helper.afterRender(component, event, helper);
    },

    openFilters: function (component, event, helper) {
        document.getElementById('filterBlock').style.display = 'block';
    },

    closeFilters: function (component, event, helper) {
        document.getElementById('filterBlock').style.display = 'none';
    },

    SearchJobs: function (component, event, helper) {
        helper.StartWaiting(component, event, helper);

        if (component.get('v.deviceType') == 'DESKTOP') {
            if (component.get('v.isInitializing') == false) {
                if (
                    component.get('v.fromDate') <= component.get('v.toDate') &&
                    component.get('v.fromDate') != null &&
                    component.get('v.toDate') != null
                ) {
                    helper.GetJobData(component, event, helper);
                } else {
                    helper.toast.info('To Date should not be before From Date.');
                    helper.StopWaiting(component, event, helper);
                }
            }
        } else {
            if (component.get('v.fromDate') != null && component.get('v.fromDate') != '') {
                helper.GetJobDataMobile(component, event, helper);
            } else {
                helper.StopWaiting(component, event, helper);
            }
        }
    },
    handleSelectOnChange: function (component, event, helper) {
        console.log('In New Method');
    },

    SearchCrewMember: function (component, event, helper) {
        var term = event.getSource().get('v.value');
        var dateString = event.getSource().get('v.id');
        var searchField = 'crew';

        var jobList = component.get('v.jobList');

        for (var i = 0; i < jobList.length; i++) {
            if (jobList[i].jobDateString == dateString) {
                jobList[i].crewDisplayList = helper.filterProcess(
                    component,
                    event,
                    helper,
                    jobList[i].crewList,
                    term,
                    searchField
                );
                component.set('v.jobList', jobList);
            }
        }
    },
    SearchSubContractor: function (component, event, helper) {
        var term = event.getSource().get('v.value');
        var dateString = event.getSource().get('v.id');
        var searchField = 'subCon';

        var jobList = component.get('v.jobList');

        for (var i = 0; i < jobList.length; i++) {
            if (jobList[i].jobDateString == dateString) {
                jobList[i].subContractorDisplayList = helper.filterProcess(
                    component,
                    event,
                    helper,
                    jobList[i].subContractorList,
                    term,
                    searchField
                );
                component.set('v.jobList', jobList);
            }
        }
    },
    SearchAssetMember: function (component, event, helper) {
        var term = event.getSource().get('v.value');
        var dateString = event.getSource().get('v.id');
        var searchField = 'asset';

        var jobList = component.get('v.jobList');

        for (var i = 0; i < jobList.length; i++) {
            if (jobList[i].jobDateString == dateString) {
                jobList[i].assetDisplayList = helper.filterProcess(
                    component,
                    event,
                    helper,
                    jobList[i].assetList,
                    term,
                    searchField
                );
                component.set('v.jobList', jobList);
            }
        }
    },

    PreviousDayJobs: function (component, event, helper) {
        helper.StartWaiting(component, event, helper);

        var newDate = new Date(component.get('v.fromDate'));
        if (isNaN(newDate.getTime())) {
            helper.StopWaiting(component, event, helper);
            helper.toast.error('Please select valid date.');
        } else {
            newDate.setDate(newDate.getDate() - 1);
            component.set('v.fromDate', $A.localizationService.formatDate(newDate, 'yyyy-MM-dd'));

            helper.GetJobDataMobile(component, event, helper);
        }
    },

    NextDayJobs: function (component, event, helper) {
        helper.StartWaiting(component, event, helper);

        var newDate = new Date(component.get('v.fromDate'));

        if (isNaN(newDate.getTime())) {
            helper.StopWaiting(component, event, helper);
            helper.toast.error('Please select valid date.');
        } else {
            newDate.setDate(newDate.getDate() + 1);
            component.set('v.fromDate', $A.localizationService.formatDate(newDate, 'yyyy-MM-dd'));

            helper.GetJobDataMobile(component, event, helper);
        }
    },

    AddCrewMobile: function (component, event, helper) {
        helper.StartWaiting(component, event, helper);

        var parameters = event.getSource().get('v.value').split('=');
        var jobList = component.get('v.jobList');

        var jobDateString = parameters[0];
        var mobilizationId = parameters[1];
        var userId = '';

        for (var i = 0; i < jobList.length; i++) {
            if (jobList[i].jobDateString == jobDateString) {
                for (var j = 0; j < jobList[i].jobWrapperList.length; j++) {
                    if (jobList[i].jobWrapperList[j].mobilizationId == mobilizationId) {
                        userId = jobList[i].jobWrapperList[j].newCrewMemberId;
                        break;
                    }
                }
                break;
            }
        }
        if (userId != null && userId != '') {
            var ignoreOverlap = true;

            var isOverLap = false;

            for (var i = 0; i < jobList.length; i++) {
                if (jobList[i].jobDateString == jobDateString) {
                    for (var j = 0; j < jobList[i].crewDisplayList.length; j++) {
                        if (
                            jobList[i].crewDisplayList[j].isSelected == 'true' ||
                            jobList[i].crewDisplayList[j].isSelected == true
                        ) {
                            isOverLap = false;
                            break;
                        }
                    }
                    break;
                }
            }
            if (isOverLap == true) {
                ignoreOverlap = confirm(
                    'Time overlapping. Do you still want to assign Crew Member to this mobilization?'
                );
            }
            if (ignoreOverlap == true) {
                helper.AssignCrewMember(component, event, helper, userId, mobilizationId);
            } else {
                helper.StopWaiting(component, event, helper);
            }
        } else {
            helper.StopWaiting(component, event, helper);
            helper.toast.info('Please Select Crew Member first.');
        }
    },
    //subcontractor
    AddSubConMobile: function (component, event, helper) {
        helper.StartWaiting(component, event, helper);

        var parameters = event.getSource().get('v.value').split('=');
        var jobList = component.get('v.jobList');

        var jobDateString = parameters[0];
        var mobilizationId = parameters[1];
        var subConId = '';

        for (var i = 0; i < jobList.length; i++) {
            if (jobList[i].jobDateString == jobDateString) {
                for (var j = 0; j < jobList[i].jobWrapperList.length; j++) {
                    if (jobList[i].jobWrapperList[j].mobilizationId == mobilizationId) {
                        subConId = jobList[i].jobWrapperList[j].newSubConMemberId;
                        break;
                    }
                }
                break;
            }
        }
        if (subConId != null && subConId != '') {
            var ignoreOverlap = true;

            var isOverLap = false;

            for (var i = 0; i < jobList.length; i++) {
                if (jobList[i].jobDateString == jobDateString) {
                    for (var j = 0; j < jobList[i].subContractorDisplayList.length; j++) {
                        if (
                            jobList[i].subContractorDisplayList[j].isSelected == 'true' ||
                            jobList[i].subContractorDisplayList[j].isSelected == true
                        ) {
                            isOverLap = false;
                            break;
                        }
                    }
                    break;
                }
            }
            if (isOverLap == true) {
                ignoreOverlap = confirm(
                    'Time overlapping. Do you still want to assign Crew Member to this mobilization?'
                );
            }
            if (ignoreOverlap == true) {
                helper.AssignSubContractor(component, event, helper, subConId, mobilizationId);
            } else {
                helper.StopWaiting(component, event, helper);
            }
        } else {
            helper.StopWaiting(component, event, helper);
            helper.toast.info('Please Select Crew Member first.');
        }
    },
    AddAssetMobile: function (component, event, helper) {
        helper.StartWaiting(component, event, helper);

        var parameters = event.getSource().get('v.value').split('=');
        var jobList = component.get('v.jobList');

        var jobDateString = parameters[0];
        var mobilizationId = parameters[1];
        var assetId = '';

        for (var i = 0; i < jobList.length; i++) {
            if (jobList[i].jobDateString == jobDateString) {
                for (var j = 0; j < jobList[i].jobWrapperList.length; j++) {
                    if (jobList[i].jobWrapperList[j].mobilizationId == mobilizationId) {
                        assetId = jobList[i].jobWrapperList[j].newAssetMemberId;
                        break;
                    }
                }
                break;
            }
        }

        if (assetId != null && assetId != '') {
            var ignoreOverlap = true;
            var isOverLap = false;

            for (var i = 0; i < jobList.length; i++) {
                if (jobList[i].jobDateString == jobDateString) {
                    for (var j = 0; j < jobList[i].assetDisplayList.length; j++) {
                        if (
                            jobList[i].assetDisplayList[j].isSelected == 'true' ||
                            jobList[i].assetDisplayList[j].isSelected == true
                        ) {
                            isOverLap = true;
                            break;
                        }
                    }
                    break;
                }
            }
            if (isOverLap == true) {
                ignoreOverlap = confirm('Time overlapping. Do you still want to assign Asset to this mobilization?');
            }

            if (ignoreOverlap == true) {
                helper.AssignAssetMember(component, event, helper, assetId, mobilizationId);
            } else {
                helper.StopWaiting(component, event, helper);
            }
        } else {
            helper.StopWaiting(component, event, helper);
            helper.toast.info('Please Select Asset first.');
        }
    },

    handleLookupSelectEvent: function (component, event, helper) {
        var selectedRecordId = event.getParam('recordId');
        var selectedrecordName = event.getParam('recordName');
    },

    OpenJobPopupGeneral: function (component, event, helper) {
        var mobObject = component.get('v.MobilizationObject') || {};
        /*
            Temporarily removing logic for default values, as it doesn't appear to work
            and logic in SchedulerController.GetDefaults is extremely fragile
        */
        mobObject.startDate = component.get('v.defaultDate');
        mobObject.endDate = component.get('v.defaultEndDate');
        var allStatuses = component.get('v.MobilizationStatuses');
        if (allStatuses.length > 1) {
            mobObject.status = allStatuses[1].value;
        } else {
            mobObject.status = '';
        }

        component.set('v.includeSaturday', component.get('v.default').includeSaturday);
        component.set('v.includeSunday', component.get('v.default').includeSunday);
        component.set('v.MobilizationObject', mobObject);

        component.set('v.JobPopup', true);
    },

    OpenJobPopup: function (component, event, helper) {
        var parameters = event.getSource().get('v.value').split('::');

        var mobObject = component.get('v.MobilizationObject') || {};
        mobObject.startDate = parameters[0];
        mobObject.endDate = parameters[1];

        var allStatuses = component.get('v.MobilizationStatuses');
        if (allStatuses.length > 0) {
            mobObject.status = allStatuses[0];
        } else {
            mobObject.status = '';
        }
        component.set('v.MobilizationObject', mobObject);

        component.set('v.JobPopup', true);
    },

    OpenUpdatePopup: function (component, event, helper) {
        var parameters = event.getSource().get('v.value').split('::');

        var mobObject = component.get('v.MobilizationObject') || {};
        mobObject.job = parameters[0];
        mobObject.startDate = parameters[1];
        mobObject.endDate = parameters[2];
        mobObject.status = parameters[3];
        mobObject.Id = parameters[4];
        mobObject.mobGroupId = parameters[5];

        component.set('v.TempJobId', parameters[0]);
        component.set('v.TempOldStartDateTime', parameters[1]);
        component.set('v.TempOldEndDateTime', parameters[2]);

        component.set('v.MobilizationObject', mobObject);
        component.set('v.UpdatePopup', true);
    },

    OpenDeletePopup: function (component, event, helper) {
        var parameters = event.getSource().get('v.value').split('::');
        component.set('v.TempJobId', parameters[0]);
        component.set('v.TempMobilizationId', parameters[1]);
        component.set('v.TempMobGroupId',parameters[2]);
        component.set('v.DeletePopup', true);
    },

    OpenCopyCrewPopup: function (component, event, helper) {
        var parameters = event.getSource().get('v.value').split('::');

        var mobObject = component.get('v.MobilizationObject') || {};
        mobObject.job = parameters[0];
        mobObject.startDate = parameters[2];
        mobObject.endDate = parameters[3];
        mobObject.mobGroupId = parameters[4];
        component.set('v.TempJobId', parameters[0]);
        component.set('v.TempMobilizationId', parameters[1]);
        component.set('v.MobilizationObject', mobObject);

        component.set('v.CopyCrewPopup', true);
    },

    OpenAssignCrewPopup: function (component, event, helper) {
        var parameters = event.getSource().get('v.name').split('::');
        component.set('v.TempCrewId', parameters[0]);
        component.set('v.TempCrewName', parameters[1]);
        component.set('v.TempIsSelected', parameters[2]);

        var jobList = event.getSource().get('v.value');
        component.set('v.TempJobList', jobList);

        component.set('v.AssignCrewPopup', true);
    },
    OpenAssignSubConPopup: function (component, event, helper) {
        var parameters = event.getSource().get('v.name').split('::');
        component.set('v.TempSubConId', parameters[0]);
        component.set('v.TempSubConName', parameters[1]);
        component.set('v.TempIsSelected', parameters[2]);

        var jobList = event.getSource().get('v.value');
        component.set('v.TempJobList', jobList);

        component.set('v.AssignSubConPopup', true);
    },

    OpenAssignAssetPopup: function (component, event, helper) {
        var parameters = event.getSource().get('v.name').split('::');
        component.set('v.TempAssetId', parameters[0]);
        component.set('v.TempAssetName', parameters[1]);
        component.set('v.TempIsSelected', parameters[2]);

        var jobList = event.getSource().get('v.value');
        component.set('v.TempJobList', jobList);

        component.set('v.AssignAssetPopup', true);
    },

    CloseJobPopup: function (component, event, helper) {
        helper.ClearTempVariables(component, event, helper);
        component.set('v.JobPopup', false);
    },

    CloseUpdatePopup: function (component, event, helper) {
        helper.ClearTempVariables(component, event, helper);
        component.set('v.UpdatePopup', false);
    },

    CloseDeletePopup: function (component, event, helper) {
        helper.ClearTempVariables(component, event, helper);
        component.set('v.DeletePopup', false);
    },

    CloseCopyCrewPopup: function (component, event, helper) {
        helper.ClearTempVariables(component, event, helper);
        component.set('v.CopyCrewPopup', false);
    },

    CloseAssignCrewPopup: function (component, event, helper) {
        helper.ClearTempVariables(component, event, helper);

        var jobList = component.get('v.TempJobList');
        for (var i = 0; i < jobList.length; i++) {
            jobList[i].isSelected = false;
        }
        component.set('v.TempJobList', jobList);
        component.set('v.TempJobList', '');
        component.set('v.AssignCrewPopup', false);
    },
    CloseAssignSubConPopup: function (component, event, helper) {
        helper.ClearTempVariables(component, event, helper);

        var jobList = component.get('v.TempJobList');
        for (var i = 0; i < jobList.length; i++) {
            jobList[i].isSelected = false;
        }
        component.set('v.TempJobList', jobList);
        component.set('v.TempJobList', '');
        component.set('v.AssignSubConPopup', false);
    },

    CloseAssignAssetPopup: function (component, event, helper) {
        helper.ClearTempVariables(component, event, helper);

        var jobList = component.get('v.TempJobList');
        for (var i = 0; i < jobList.length; i++) {
            jobList[i].isSelected = false;
        }
        component.set('v.TempJobList', jobList);
        component.set('v.TempJobList', '');
        component.set('v.AssignAssetPopup', false);
    },

    SaveJob: function (component, event, helper) {
        var startDate = component.find("startDate");
        var endDate = component.find("endDate");
        if($A.util.isEmpty(startDate.get("v.value"))){
            helper.forms.setError(startDate,'Start date can not be blank');
            return;
        }
        if($A.util.isEmpty(endDate.get("v.value"))){
            helper.forms.setError(endDate,'End date can not be blank');
            return;
        }
        if(startDate.get("v.value") > endDate.get('v.value')){
            helper.forms.setError(startDate,'Start date can not be greater than End Date');
            return;
        }else{
            helper.forms.clearError(startDate);
            helper.forms.clearError(endDate);
        }
        helper.StartWaiting(component, event, helper);

        var JobId = component.find('popupJobId').get('v.selectedRecordId');

        if (JobId != null && JobId != '') {
            helper.SaveSchedule(component, event, helper);
        } else {
            helper.StopWaiting(component, event, helper);
            helper.toast.error('Please select a job.');
        }
    },

    UpdateSchedule: function (component, event, helper) {
        helper.StartWaiting(component, event, helper);
        helper.MassUpdateStatus(component, event, helper);
    },

    CopyCrew: function (component, event, helper) {
        helper.StartWaiting(component, event, helper);
        helper.CopyJobSchedule(component, event, helper);
    },

    DeleteSchedule: function (component, event, helper) {
        helper.StartWaiting(component, event, helper);
        helper.DeleteSchedule(component, event, helper);
    },

    RemoveCrewMember: function (component, event, helper) {
        helper.StartWaiting(component, event, helper);
        var UserId = event.getSource().get('v.value');
        helper.RemoveCrewMember(component, event, helper, UserId);
    },
    RemoveSubContractor: function (component, event, helper) {
        helper.StartWaiting(component, event, helper);
        var subConId = event.getSource().get('v.value');
        var mobId = event.getSource().get('v.name');
        helper.RemoveSubContractor(component, event, helper, subConId,mobId);
    },
    RemoveAssetMember: function (component, event, helper) {
        helper.StartWaiting(component, event, helper);
        var AssetId = event.getSource().get('v.value');
        helper.RemoveAssetMember(component, event, helper, AssetId);
    },

    AssignCrewMember: function (component, event, helper) {
        helper.StartWaiting(component, event, helper);

        var userId = component.get('v.TempCrewId');
        var wasAssigned = component.get('v.TempIsSelected');
        var mobilizationId;
        var memberId;

        var jobList = component.get('v.TempJobList');

        if (wasAssigned) {
            for (var i = 0; i < jobList.length; i++) {
                for (var j = 0; j < jobList[i].jobMemberList.length; j++) {
                    if (userId == jobList[i].jobMemberList[j].userId) {
                        memberId = jobList[i].jobMemberList[j].memberId;
                        break;
                    }
                }
            }
        }

        var recordCount = 0;
        for (var i = 0; i < jobList.length; i++) {
            if (jobList[i].isSelected) {
                mobilizationId = jobList[i].mobilizationId;
                recordCount++;
            }
            if (recordCount > 1) {
                helper.toast.info('You can not select more than one Job.');
                helper.StopWaiting(component, event, helper);
                break;
            }
        }
        if (recordCount == 0) {
            helper.toast.error('Select any one job.');
            helper.StopWaiting(component, event, helper);
        } else if (recordCount == 1) {
            if (wasAssigned) {
                if (memberId != null && memberId != '') {
                    helper.RemoveCrewMember(component, event, helper, memberId);
                }
            }
            helper.AssignCrewMember(component, event, helper, userId, mobilizationId);

            for (var i = 0; i < jobList.length; i++) {
                jobList[i].isSelected = false;
            }
            component.set('v.TempJobList', jobList);
            component.set('v.TempJobList', '');
            component.set('v.AssignCrewPopup', false);
        }
    },
    AssignSubConMember: function (component, event, helper) {
        helper.StartWaiting(component, event, helper);

        var subConId = component.get('v.TempSubConId');
        var wasAssigned = component.get('v.TempIsSelected');
        var mobilizationId;
        var memberId;

        var jobList = component.get('v.TempJobList');

        if (wasAssigned) {
            for (var i = 0; i < jobList.length; i++) {
                for (var j = 0; j < jobList[i].subConMemberList.length; j++) {
                    if (subConId == jobList[i].subConMemberList[j].subConId) {
                        memberId = jobList[i].subConMemberList[j].memberId;
                        break;
                    }
                }
            }
        }

        var recordCount = 0;
        for (var i = 0; i < jobList.length; i++) {
            if (jobList[i].isSelected) {
                mobilizationId = jobList[i].mobilizationId;
                recordCount++;
            }
            if (recordCount > 1) {
                helper.toast.info('You can not select more than one Job.');
                helper.StopWaiting(component, event, helper);
                break;
            }
        }
        if (recordCount == 0) {
            helper.toast.error('Select any one job.');
            helper.StopWaiting(component, event, helper);
        } else if (recordCount == 1) {
            if (wasAssigned) {
                if (subConId != null && subConId != '') {
                    helper.RemoveSubContractor(component, event, helper, subConId,mobilizationId);
                }
            }
            helper.AssignSubContractor(component, event, helper, subConId, mobilizationId);

            for (var i = 0; i < jobList.length; i++) {
                jobList[i].isSelected = false;
            }
            component.set('v.TempJobList', jobList);
            component.set('v.TempJobList', '');
            component.set('v.AssignSubConPopup', false);
        }
    },
    AssignAssetMember: function (component, event, helper) {
        helper.StartWaiting(component, event, helper);

        var assetId = component.get('v.TempAssetId');
        var wasAssigned = component.get('v.TempIsSelected');
        var mobilizationId;
        var mobAssetId;

        var jobList = component.get('v.TempJobList');

        if (wasAssigned) {
            for (var i = 0; i < jobList.length; i++) {
                for (var j = 0; j < jobList[i].mobAssetList.length; j++) {
                    if (assetId == jobList[i].mobAssetList[j].assetId) {
                        mobAssetId = jobList[i].mobAssetList[j].mobAssetId;
                        break;
                    }
                }
            }
        }

        var recordCount = 0;
        for (var i = 0; i < jobList.length; i++) {
            if (jobList[i].isSelected) {
                mobilizationId = jobList[i].mobilizationId;
                recordCount++;
            }
            if (recordCount > 1) {
                helper.toast.info('You can not select more than one Job.');
                break;
            }
        }
        if (recordCount == 0) {
            helper.toast.error('Select any one job.');
        } else if (recordCount == 1) {
            if (wasAssigned) {
                if (mobAssetId != null && mobAssetId != '') {
                    helper.RemoveAssetMember(component, event, helper, mobAssetId);
                }
            }

            helper.AssignAssetMember(component, event, helper, assetId, mobilizationId);
            for (var i = 0; i < jobList.length; i++) {
                jobList[i].isSelected = false;
            }
            component.set('v.TempJobList', jobList);
            component.set('v.TempJobList', '');
            component.set('v.AssignAssetPopup', false);
        }
    },

    // Drag User
    dragstart: function (component, event, helper) {
        component.set('v.dragUserId', event.target.dataset.dragId);
        component.set('v.TempOverlapCheck', event.target.dataset.dragSelected);
        component.set('v.dragDate', event.target.id);
        component.set('v.dragIdType', 'User');
    },

    // Drag Asset
    dragstartAsset: function (component, event, helper) {
        component.set('v.dragAssetId', event.target.dataset.dragId);
        component.set('v.TempOverlapCheck', event.target.dataset.dragSelected);
        component.set('v.dragDate', event.target.id);
        component.set('v.dragIdType', 'Asset');
    },
    dragstartSubContractor: function (component, event, helper) {
        component.set('v.dragSubConId', event.target.dataset.dragId);
        component.set('v.TempOverlapCheck', event.target.dataset.dragSelected);
        component.set('v.dragDate', event.target.id);
        component.set('v.dragIdType', 'Subcontractor');
    },
    dragstartMove: function (component, event, helper) {
        component.set('v.dragUserId', event.target.dataset.dragMember);
        component.set('v.dragDate', event.target.dataset.dragDate);
        component.set('v.TempOverlapCheck', false);
        component.set('v.dragIdType', 'User');
    },
    dragstartSubConMove: function (component, event, helper) {
        component.set('v.dragSubConId', event.target.dataset.dragMember);
        component.set('v.dragDate', event.target.dataset.dragDate);
        component.set('v.TempOverlapCheck', false);
        component.set('v.dragIdType', 'Subcontractor');
    },

    dragstartAssetMove: function (component, event, helper) {
        component.set('v.dragAssetId', event.target.dataset.dragMember);
        component.set('v.dragDate', event.target.dataset.dragDate);
        component.set('v.TempOverlapCheck', false);
        component.set('v.dragIdType', 'Asset');
    },

    drop: function (component, event, helper) {
        helper.StartWaiting(component, event, helper);

        var mobilizationId = event.target.id;
        var userId = component.get('v.dragUserId');
        var assetId = component.get('v.dragAssetId');
        var subConId = component.get('v.dragSubConId');
        var dragDate = component.get('v.dragDate');
        var idType = component.get('v.dragIdType');
        var isOverLap = component.get('v.TempOverlapCheck');

        var ignoreOverlap = true;

        if (isOverLap == 'true') {
            if (idType == 'User') {
                ignoreOverlap = confirm('Time overlapping. Do you still want to assign Crew Member to this mobilization?');
            } else if (idType == 'Asset') {
                ignoreOverlap = confirm('Time overlapping. Do you still want to assign Asset to this mobilization?');
            }else if (idType == 'Subcontractor') {
                ignoreOverlap = confirm('Time overlapping. Do you still want to assign SubContractor to this mobilization?');
            }
        }

        if (ignoreOverlap == true) {
            if (idType == 'User') {
                helper.AssignCrewMember(component, event, helper, userId, mobilizationId);
            } else if (idType == 'Asset') {
                helper.AssignAssetMember(component, event, helper, assetId, mobilizationId, false);
            }else if (idType == 'Subcontractor') {
                helper.AssignSubContractor(component, event, helper, subConId, mobilizationId, false);
            }
        } else {
            helper.StopWaiting(component, event, helper);
        }

        component.set('v.dragUserId', '');
        component.set('v.dragAssetId', '');
        component.set('v.dragSubConId', '');
        component.set('v.dragDate', '');
        component.set('v.dragIdType', '');
        event.preventDefault();
    },

    cancel: function (component, event, helper) {
        event.preventDefault();
    }
});