({
    afterRender: function (component, event, helper) {
        event.stopPropagation();
    },

    SetDefaults: function (component, event, helper) {
        var self = this;
        var action = component.get('c.GetDefaults');

        action.setCallback(this, function (response) {
            var state = response.getState();
            if (state === 'SUCCESS') {
                var defaultValues = response.getReturnValue();
                component.set('v.LevelTwoAccess',true);

                component.set('v.default', defaultValues);
                component.set('v.defaultStartTime', defaultValues.defaultStartTime);
                component.set('v.defaultEndTime', defaultValues.defaultEndTime);
                component.set('v.defaultDate', defaultValues.defaultDate);
                component.set('v.defaultEndDate', defaultValues.defaultEndDate);
                component.set('v.vehicleBackground', defaultValues.vehicleBackground);
                component.set('v.vehicleColor', defaultValues.vehicleColor);
                component.set('v.includeSaturday', defaultValues.includeSaturday);
                component.set('v.includeSunday', defaultValues.includeSunday);

                var statuses = defaultValues.jobStatusList;


                var AllStatuses = '';
                var isFirst = true;

                var mobiStatuses = [];
                var opts = [{ class: 'optionClass', label: '--All--', value: 'All', selected: 'true' }];

                for (var i = 0; i < statuses.length; i++) {
                    if (isFirst) {
                        AllStatuses = statuses[i].apiName;
                        isFirst = false;
                    } else {
                        AllStatuses += ';' + statuses[i].apiName;
                    }
                    opts.push({ class: 'optionClass', label: statuses[i], value: statuses[i] });
                    mobiStatuses.push({label : statuses[i].label,value : statuses[i].apiName});
                }
                mobiStatuses.unshift({label : 'All',value : ''});
                component.set('v.AllStatuses', AllStatuses);
                component.set('v.MobilizationStatuses', mobiStatuses);

                if (component.get('v.deviceType') == 'DESKTOP') {
                    component.find('InputSelectMultiple').set('v.options', opts);
                }
            } else if (state === 'ERROR') {
                component.set('v.LevelTwoAccess',false);
                let errMsg = response.getError()[0].message;
                try {
                    self.toast.error(JSON.parse(response.getError()[0].message).message);
                } catch (e) {
                   try{
                        if(!errMsg.includes('Second')){
                            self.toast.error(response.getError()[0].message);
                        }
                        else{
                            return;
                        }
                    }catch(err){
                        self.toast.error(err.message);
                    }
                }
            }
        });
        $A.enqueueAction(action);
    },

    GetJobData: function (component, event, helper) {
        var self = this;
        var statusString = component.get('v.currentStatus');
            //component.find('InputSelectMultiple').get('v.value');
        var compareStatuses = component.get('v.AllStatuses');
        //var statusList = statusString.split(';');
        if (statusString == 'All' || statusString == '' || statusString == undefined) {
            statusString = compareStatuses;   
        }

        var action = component.get('c.GetJobData');
        action.setParams({
            selectedStatuses: statusString,
            startDate: $A.localizationService.formatDate(component.get('v.fromDate'), 'YYYY-MM-DD'),
            endDate: $A.localizationService.formatDate(component.get('v.toDate'), 'YYYY-MM-DD'),
            device: 'DESKTOP'
        });

        action.setCallback(this, function (response) {
            var state = response.getState();
            if (state === 'SUCCESS') {
                var DateWiseWrapperList = response.getReturnValue();
                component.set('v.jobList', DateWiseWrapperList);

                helper.StopWaiting(component, event, helper);
            } else if (state === 'ERROR') {
                try {
                    self.toast.error(JSON.parse(response.getError()[0].message).message);
                } catch (e) {
                   try{
                        self.toast.error(response.getError()[0].message);
                    }catch(err){
                        self.toast.error(err.message);
                    }
                }
                helper.StopWaiting(component, event, helper);
            }
        });
        $A.enqueueAction(action);
    },

    GetJobDataMobile: function (component, event, helper) {
        var self = this;
        var statusString = component.get('v.AllStatuses');

        var action = component.get('c.GetJobData');
        action.setParams({
            selectedStatuses: statusString,
            startDate: $A.localizationService.formatDate(component.get('v.fromDate'), 'YYYY-MM-DD'),
            endDate: $A.localizationService.formatDate(component.get('v.fromDate'), 'YYYY-MM-DD'),
            device: 'PHONE'
        });

        action.setCallback(this, function (response) {
            var state = response.getState();
            if (state === 'SUCCESS') {
                var DateWiseWrapperList = response.getReturnValue();
                component.set('v.jobList', DateWiseWrapperList);

                helper.StopWaiting(component, event, helper);
            } else if (state === 'ERROR') {
                try {
                    self.toast.error(JSON.parse(response.getError()[0].message).message);
                } catch (e) {
                   try{
                        self.toast.error(response.getError()[0].message);
                    }catch(err){
                        self.toast.error(err.message);
                    }
                }
            }
        });
        $A.enqueueAction(action);
    },

    SaveSchedule: function (component, event, helper) {
        var self = this;
        var jobLookup = component.find('popupJobId');
        var JobId = jobLookup.get('v.selectedRecordId');

        var mb = component.get('v.MobilizationObject') || {};

        if (mb.startDate < mb.endDate) {
            component.set('v.JobPopup', false);
            console.log('mob before save here: ', JSON.parse(JSON.stringify(mb)));
            var action = component.get('c.SaveJobSchedule');
            action.setParams({
                jobId: JobId,
                startDateTime: mb.startDate,
                endDateTime: mb.endDate,
                status: mb.status,
                incSatur : component.find('saturday').get('v.checked'),
                incSun : component.find('sunday').get('v.checked')
            });

            action.setCallback(this, function (response) {
                var state = response.getState();
                if (state === 'SUCCESS') {
                    if (response.getReturnValue() == 'SUCCESS') {
                        helper.IsDesktopOrPhone(component, event, helper);
                    } else {
                        helper.StopWaiting(component, event, helper);
                    }
                } else if (state === 'ERROR') {
                    try {
                        self.toast.error(JSON.parse(response.getError()[0].message).message);
                    } catch (e) {
                        try{
                            self.toast.error(response.getError()[0].message);
                        }catch(err){
                            self.toast.error(err.message);
                        }
                    }
                    helper.StopWaiting(component, event, helper);
                }
            });
            $A.enqueueAction(action);

            helper.ClearTempVariables(component, event, helper);
        } else {
            self.toast.error('End date should be after start date.');
            helper.StopWaiting(component, event, helper);
        }
        console.log('Record Created');
    },

    CopyJobSchedule: function (component, event, helper) {
        var self = this;
        var mb = component.get('v.MobilizationObject') || {};
        component.set('v.CopyCrewPopup', false);

        var action = component.get('c.CopySchedule');
        action.setParams({
            jobId: component.get('v.TempJobId'),
            mobId: component.get('v.TempMobilizationId'),
            startDate: mb.startDate,
            endDate: mb.endDate,
            mobGroupId : mb.mobGroupId
        });

        action.setCallback(this, function (response) {
            var state = response.getState();
            if (state === 'SUCCESS') {
                if (response.getReturnValue() == 'SUCCESS') {
                    helper.IsDesktopOrPhone(component, event, helper);
                } else {
                    helper.StopWaiting(component, event, helper);
                }
            } else if (state === 'ERROR') {
                try {
                    self.toast.error(JSON.parse(response.getError()[0].message).message);
                } catch (e) {
                   try{
                        self.toast.error(response.getError()[0].message);
                    }catch(err){
                        self.toast.error(err.message);
                    }
                }
                helper.StopWaiting(component, event, helper);
            }
        });
        $A.enqueueAction(action);

        helper.ClearTempVariables(component, event, helper);
    },

    MassUpdateStatus: function (component, event, helper) {
        var self = this;

        var mb = component.get('v.MobilizationObject') || {};

        if (mb.startDate < mb.endDate) {
            component.set('v.UpdatePopup', false);

            var action = component.get('c.MassUpdateSchedule');

            action.setParams({
                recordId: mb.Id,
                jobId: component.get('v.TempJobId'),
                newStatus: mb.status,
                newStartDate: mb.startDate,
                newEndDate: mb.endDate,
                oldStartDate: component.get('v.TempOldStartDateTime'),
                oldEndDate: component.get('v.TempOldEndDateTime'),
                mobGroupId : mb.mobGroupId
            });

            action.setCallback(this, function (response) {
                var state = response.getState();
                if (state === 'SUCCESS') {
                    if (response.getReturnValue() === 'SUCCESS') {
                        helper.IsDesktopOrPhone(component, event, helper);
                    } else {
                        helper.StopWaiting(component, event, helper);
                    }
                } else if (state === 'ERROR') {
                    try {
                        self.toast.error(JSON.parse(response.getError()[0].message).message);
                    } catch (e) {
                       try{
                        self.toast.error(response.getError()[0].message);
                    }catch(err){
                        self.toast.error(err.message);
                    }
                    }
                    helper.StopWaiting(component, event, helper);
                }
            });
            $A.enqueueAction(action);

            helper.ClearTempVariables(component, event, helper);
        } else {
            self.toast.error('End date should be after start date.');
            helper.StopWaiting(component, event, helper);
        }
    },

    DeleteSchedule: function (component, event, helper) {
        var self = this;
        var selectedOption = component.find('radioGroupButtonId').get('v.value');
        var deleteAll = selectedOption == 2 ? true : false;
        var mb = component.get('v.MobilizationObject') || {};

        component.set('v.DeletePopup', false);

        var action = component.get('c.DeleteJobSchedule');
        action.setParams({
            jobId: component.get('v.TempJobId'),
            mobId: component.get('v.TempMobilizationId'),
            deleteAll: deleteAll,
            mobGroupId : component.get('v.TempMobGroupId')
        });

        action.setCallback(this, function (response) {
            var state = response.getState();
            if (state === 'SUCCESS') {
                if (response.getReturnValue() == 'SUCCESS') {
                    helper.IsDesktopOrPhone(component, event, helper);
                } else {
                    helper.StopWaiting(component, event, helper);
                }
            } else if (state === 'ERROR') {
                try {
                    self.toast.error(JSON.parse(response.getError()[0].message).message);
                } catch (e) {
                   try{
                        self.toast.error(response.getError()[0].message);
                    }catch(err){
                        self.toast.error(err.message);
                    }
                }
                helper.StopWaiting(component, event, helper);
            }
        });
        $A.enqueueAction(action);

        helper.ClearTempVariables(component, event, helper);
    },

    StartWaiting: function (component, event, helper) {
        component.set('v.showSpinner', true);
    },

    StopWaiting: function (component, event, helper) {
        component.set('v.showSpinner', false);
    },

    AssignCrewMember: function (component, event, helper, userId, mobilizationId) {
        var self = this;

        var action = component.get('c.AssignUser');
        action.setParams({
            userId: userId,
            mobId: mobilizationId,
            chkOverlap: false
        });

        action.setCallback(this, function (response) {
            var state = response.getState();
            if (state === 'SUCCESS') {
                if (response.getReturnValue() == 'SUCCESS') {
                    helper.IsDesktopOrPhone(component, event, helper);
                } else {
                    helper.StopWaiting(component, event, helper);
                }
            } else if (state === 'ERROR') {
                try {
                    self.toast.error(JSON.parse(response.getError()[0].message).message);
                } catch (e) {
                   try{
                        self.toast.error(response.getError()[0].message);
                    }catch(err){
                        self.toast.error(err.message);
                    }
                }
                helper.StopWaiting(component, event, helper);
            }
        });
        $A.enqueueAction(action);

        helper.ClearTempVariables(component, event, helper);
    },

    AssignAssetMember: function (component, event, helper, assetId, mobilizationId) {
        var self = this;

        var action = component.get('c.AssignAsset');
        action.setParams({
            assetId: assetId,
            mobId: mobilizationId,
            chkOverlap: false
        });

        action.setCallback(this, function (response) {
            var state = response.getState();
            if (state === 'SUCCESS') {
                if (response.getReturnValue() == 'SUCCESS') {
                    helper.IsDesktopOrPhone(component, event, helper);
                } else {
                    helper.StopWaiting(component, event, helper);
                }
            } else if (state === 'ERROR') {
                try {
                    self.toast.error(JSON.parse(response.getError()[0].message).message);
                } catch (e) {
                   try{
                        self.toast.error(response.getError()[0].message);
                    }catch(err){
                        self.toast.error(err.message);
                    }
                }
                helper.StopWaiting(component, event, helper);
            }
        });
        $A.enqueueAction(action);

        helper.ClearTempVariables(component, event, helper);
    },
    AssignSubContractor: function (component, event, helper, subConId, mobilizationId) {
        var self = this;

        var action = component.get('c.AssignSubContractor');
        action.setParams({
            subConId: subConId,
            mobId: mobilizationId,
            chkOverlap: false,
            isDelete : false
        });

        action.setCallback(this, function (response) {
            var state = response.getState();
            if (state === 'SUCCESS') {
                if (response.getReturnValue() == 'SUCCESS') {
                    helper.IsDesktopOrPhone(component, event, helper);
                } else {
                    helper.StopWaiting(component, event, helper);
                }
            } else if (state === 'ERROR') {
                try {
                    self.toast.error(JSON.parse(response.getError()[0].message).message);
                } catch (e) {
                   try{
                        self.toast.error(response.getError()[0].message);
                    }catch(err){
                        self.toast.error(err.message);
                    }
                }
                helper.StopWaiting(component, event, helper);
            }
        });
        $A.enqueueAction(action);

        helper.ClearTempVariables(component, event, helper);
    },

    RemoveCrewMember: function (component, event, helper, UserId) {
        var self = this;

        var action = component.get('c.AssignUser');
        action.setParams({
            userId: UserId,
            mobId: 'delete',
            chkOverlap: false
        });

        action.setCallback(this, function (response) {
            var state = response.getState();
            if (state === 'SUCCESS') {
                if (response.getReturnValue() == 'SUCCESS') {
                    helper.IsDesktopOrPhone(component, event, helper);
                } else {
                    helper.StopWaiting(component, event, helper);
                }
            } else if (state === 'ERROR') {
                try {
                    self.toast.error(JSON.parse(response.getError()[0].message).message);
                } catch (e) {
                   try{
                        self.toast.error(response.getError()[0].message);
                    }catch(err){
                        self.toast.error(err.message);
                    }
                }
                helper.StopWaiting(component, event, helper);
            }
        });
        $A.enqueueAction(action);

        helper.ClearTempVariables(component, event, helper);
    },
    RemoveSubContractor: function (component, event, helper, subConId,mobId) {
        var self = this;

        var action = component.get('c.AssignSubContractor');
        action.setParams({
            subConId: subConId,
            mobId: mobId,
            chkOverlap: false,
            isDelete : true
        });

        action.setCallback(this, function (response) {
            var state = response.getState();
            if (state === 'SUCCESS') {
                if (response.getReturnValue() == 'SUCCESS') {
                    helper.IsDesktopOrPhone(component, event, helper);
                } else {
                    helper.StopWaiting(component, event, helper);
                }
            } else if (state === 'ERROR') {
                try {
                    self.toast.error(JSON.parse(response.getError()[0].message).message);
                } catch (e) {
                   try{
                        self.toast.error(response.getError()[0].message);
                    }catch(err){
                        self.toast.error(err.message);
                    }
                }
                helper.StopWaiting(component, event, helper);
            }
        });
        $A.enqueueAction(action);

        helper.ClearTempVariables(component, event, helper);
    },
    RemoveAssetMember: function (component, event, helper, AssetId) {
        var self = this;
        var action = component.get('c.AssignAsset');
        action.setParams({
            assetId: AssetId,
            mobId: 'delete',
            chkOverlap: false
        });

        action.setCallback(this, function (response) {
            var state = response.getState();
            if (state === 'SUCCESS') {
                if (response.getReturnValue() == 'SUCCESS') {
                    helper.IsDesktopOrPhone(component, event, helper);
                } else {
                    helper.StopWaiting(component, event, helper);
                }
            } else if (state === 'ERROR') {
                try {
                    self.toast.error(JSON.parse(response.getError()[0].message).message);
                } catch (e) {
                   try{
                        self.toast.error(response.getError()[0].message);
                    }catch(err){
                        self.toast.error(err.message);
                    }
                }
                helper.StopWaiting(component, event, helper);
            }
        });
        $A.enqueueAction(action);

        helper.ClearTempVariables(component, event, helper);
    },

    filterProcess: function (component, event, helper, data, term, searchField) {
        var results = data,
            regex;
        try {
            regex = new RegExp(term, 'i');

            if (searchField == 'crew') {
                results = data.filter(row => regex.test(row.userName));
            } else if (searchField == 'asset') {
                results = data.filter(row => regex.test(row.assetName));
            } else if (searchField == 'subCon'){
                results = data.filter(row => regex.test(row.name));
            }
        } catch (e) {}
        return results;
    },

    IsDesktopOrPhone: function (component, event, helper) {
        if (component.get('v.deviceType') == 'DESKTOP') {
            helper.GetJobData(component, event, helper);
        } else {
            helper.GetJobDataMobile(component, event, helper);
        }
    },

    ClearTempVariables: function (component, event, helper) {
        component.set('v.TempJobId', '');
        component.set('v.TempMobilizationId', '');
        component.set('v.TempStatus', '');
        component.set('v.TempStartDateTime', '');
        component.set('v.TempEndDateTime', '');
        component.set('v.TempOldStartDateTime', '');
        component.set('v.TempOldEndDateTime', '');

        component.set('v.TempCrewId', '');
        component.set('v.TempSubConId', '');
        component.set('v.TempSubConName', '');
        component.set('v.TempCrewName', '');
        component.set('v.TempAssetId', '');
        component.set('v.TempAssetName', '');
        component.set('v.TempIsSelected', false);

        var mobObject = component.get('v.MobilizationObject') || {};
        mobObject.job = '';
        mobObject.startDate = '';
        mobObject.endDate = '';
        mobObject.status = '';
        component.set('v.MobilizationObject', mobObject);
    },

    checkAccess: function (component, event, helper) {
        var self = this;
        var accessCheck = component.get('c.checkProfileAccess');
        accessCheck.setParams({
            objName: 'Mobilization_Group__c'
        });
        accessCheck.setCallback(this, function (response) {
            var state = response.getState();
            if (state === 'SUCCESS') {
                component.set('v.EditFlag', response.getReturnValue().EditFlag);
                component.set('v.ReadFlag', response.getReturnValue().ReadFlag);
                component.set('v.CreateFlag', response.getReturnValue().CreateFlag);
                component.set('v.DeleteFlag', response.getReturnValue().DeleteFlag);
            } else if (state === 'ERROR') {
                try {
                    self.toast.error(JSON.parse(response.getError()[0].message).message);
                } catch (e) {
                   try{
                        self.toast.error(response.getError()[0].message);
                    }catch(err){
                        self.toast.error(err.message);
                    }
                }
            }
        });
        $A.enqueueAction(accessCheck);
    }
});