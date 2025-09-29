({
    getMarkers: function (component, event, helper) {
        var self = this;
        var action = component.get('c.getGeneralMarkers');
        action.setCallback(this, function (response) {
            var state = response.getState();

            if (state === 'SUCCESS') {
                component.set('v.mapMarkers', response.getReturnValue());
                component.set('v.center', { location: { State: 'KS', Country: 'USA' } });
                component.set('v.markersTitle', 'Statewise job count');
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
    getNamespace: function (component, event, helper) {
        var action = component.get('c.getNamespace');
        action.setCallback(this, function (response) {
            var state = response.getState();
            if (state === 'SUCCESS') {
                component.set('v.namespaceWithUnderscore', response.getReturnValue());
                component.set('v.namespaceLoaded', true);
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

    getFilteredMarkers: function (component, event, helper, selectedFilter, lt, lg, stateName) {
        var stateValue = 'CA';
        var action = component.get('c.getJobMarkers');
        var self = this;
        action.setParams({
            searchType: selectedFilter,
            latValue: lt,
            longValue: lg,
            stateName: stateName
        });

        action.setCallback(this, function (response) {
            var state = response.getState();

            if (state === 'SUCCESS') {
                component.set('v.mapMarkers', response.getReturnValue());

                if (selectedFilter == 'nearby') {
                    component.set('v.center', { location: { Latitude: lt, Longitude: lg } });
                    component.set('v.markersTitle', 'Near by jobs');
                } else if (selectedFilter == 'update') {
                    component.set('v.center', { location: { Country: 'USA' } });
                    component.set('v.markersTitle', 'Recently updated jobs');
                } else if (selectedFilter == 'view') {
                    component.set('v.center', { location: { Country: 'USA' } });
                    component.set('v.markersTitle', 'Recently viewed jobs');
                } else if (selectedFilter == 'state') {
                    component.set('v.center', { location: { State: stateName } });
                    component.set('v.markersTitle', 'Jobs available in ' + stateName);
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
            }
        });
        $A.enqueueAction(action);
    },

    StateMarkers: function (component, event, helper) {
        var stateValue = 'CA';
        var action = component.get('c.getStateMarkers');
        var self = this;
        action.setParams({
            stateName: stateValue
        });

        action.setCallback(this, function (response) {
            var state = response.getState();

            if (state === 'SUCCESS') {
                component.set('v.mapMarkers', response.getReturnValue());
                component.set('v.center', { location: { State: stateValue } });
                component.set('v.markersTitle', 'Jobs available in ' + stateValue);
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

    NearByMarkers: function (component, event, helper) {
        var action = component.get('c.getNearByJobs');
        action.setParams({
            latValue: 30.2694158,
            longValue: -97.7572036
        });
        var self = this;
        action.setCallback(this, function (response) {
            var state = response.getState();

            if (state === 'SUCCESS') {
                component.set('v.mapMarkers', response.getReturnValue());
                component.set('v.center', { location: { State: 'CA' } });
                component.set('v.markersTitle', 'Near by jobs');
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

    RecentlyUpdatedMarkers: function (component, event, helper) {
        var self = this;
        var action = component.get('c.getRecentlyUpdatedJobs');
        action.setCallback(this, function (response) {
            var state = response.getState();

            if (state === 'SUCCESS') {
                component.set('v.mapMarkers', response.getReturnValue());
                component.set('v.center', { location: { Country: 'USA' } });
                component.set('v.markersTitle', 'Recently updated jobs');
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

    RecentlyViewedMarkers: function (component, event, helper) {
        var self = this;
        var action = component.get('c.getRecentlyViewedJobs');
        action.setCallback(this, function (response) {
            var state = response.getState();

            if (state === 'SUCCESS') {
                component.set('v.mapMarkers', response.getReturnValue());
                component.set('v.center', { location: { Country: 'USA' } });
                component.set('v.markersTitle', 'Recently viewed jobs');
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
    }
});