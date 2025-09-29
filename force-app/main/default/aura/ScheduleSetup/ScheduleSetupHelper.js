({
    fetchData: function (component) {
        var self = this;
        var action = component.get("c.getScheduleSetup");
        action.setCallback(this, function(a) {
            var state = a.getState();
            if (state === "SUCCESS"){
                var setupValues = a.getReturnValue();
                component.set("v.mobilizationStatusColors", setupValues.mobilizationStatuses);
                component.set("v.assetColors", setupValues.assetTypes);
                component.set("v.startTime", self.convertFromAMPM(setupValues.startTime));
                component.set("v.endTime", self.convertFromAMPM(setupValues.endTime));
            }  else if(state === "ERROR"){
                try{
                    self.toast.error(JSON.parse(response.getError()[0].message).message);
                }catch(e){
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
    saveData: function (component) {
        var self = this;
        var action = component.get("c.saveScheduleSetup");
        var setupWrapper = {
            'mobilizationStatuses': component.get("v.mobilizationStatusColors"),
            'assetTypes': component.get("v.assetColors"),
            'startTime': this.convertToAMPM(component.get("v.startTime")),
            'endTime': this.convertToAMPM(component.get("v.endTime"))
        };


		action.setParams({ setupWrapper : setupWrapper});
        action.setCallback(this, function(a) {
            var state = a.getState();
            if (state === "SUCCESS"){
                self.toast.success('Settings successfully saved');
            }else if(state === "ERROR"){
                try{
                    self.toast.error(JSON.parse(response.getError()[0].message).message);
                }catch(e){
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

    convertToAMPM : function ( timeToConvert ){
        if (timeToConvert) {
            var timeSections = timeToConvert.split(':');
            var hours = timeSections[0];
            var minutes = timeSections[1];
            var AmOrPm = hours >= 12 ? 'PM' : 'AM';
            hours = (hours % 12) || hours;
            if (hours.toString().length < 2) {
                hours = '0' + hours;
            }
            return hours + ':' + minutes + ' ' + AmOrPm;
        }
        return timeToConvert;
    },
    convertFromAMPM : function ( timeToConvert ){
        if (timeToConvert) {
            var timeSections = timeToConvert.split(':');
            var minSections = timeSections[1].split(' ');
            var hours = timeSections[0];
            var minutes = minSections[0];
            hours = minSections[1] === 'PM' ? (parseInt(hours) + 12).toString(): hours;
            return hours + ':' + minutes + ':00.000';
        }
        return timeToConvert;
    },
})