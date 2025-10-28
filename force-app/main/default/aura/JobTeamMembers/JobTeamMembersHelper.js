({
    getTeamMembers: function (component, event, helper) {
        component.set('v.columns', [
            { label: 'Name', fieldName: 'name', type: 'text' },
            { label: 'Status', fieldName: 'status', type: 'text' }
        ]);

        var action = component.get('c.getJobTeamMembers');
        var self = this;
        var recordId = component.get('v.recordId');
        action.setParams({
            jobId: recordId
        });

        action.setCallback(this, function (response) {
            var state = response.getState();
            if (state === 'SUCCESS') {
                component.set('v.secondLevelAccess',true);
                component.set('v.jobTeamMembers', JSON.parse(response.getReturnValue()));
            } else if (state === 'ERROR') {
                component.set('v.secondLevelAccess',false);
                let errMsg = response.getError()[0].message;
                console.log('error: ', JSON.parse(JSON.stringify(response.getError()[0])));
                try {
                    if(!errMsg.includes('Second')){
                        self.toast.error(response.getError()[0].message);
                    }
                    return;
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
    }
});