({
    init: function (component, event, helper) {
        helper.getMarkers(component, event, helper);
        helper.getNamespace(component, event, helper);
    },

    Search: function (component, event, helper) {
        var selectedFilter = component.get('v.filterValue');
        if (selectedFilter == 'count') {
            helper.getMarkers(component, event, helper);
        } else if (selectedFilter == 'nearby') {
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(success);

                function success(position) {
                    component.set('v.latitude', position.coords.latitude);
                    component.set('v.longitude', position.coords.longitude);
                    component.set('v.isLocated', true);
                    helper.getFilteredMarkers(
                        component,
                        event,
                        helper,
                        selectedFilter,
                        position.coords.latitude,
                        position.coords.longitude,
                        ''
                    );
                }
            } else {
                component.set('v.isLocated', false);
                error('Geo Location is not supported');
            }
        } else if (selectedFilter == 'update') {
            helper.getFilteredMarkers(component, event, helper, selectedFilter, null, null, '');
        } else if (selectedFilter == 'view') {
            helper.getFilteredMarkers(component, event, helper, selectedFilter, null, null, '');
        }
    },

    SearchStateJobs: function (component, event, helper) {
        var stateName = event.getSource().get('v.value');
        helper.getFilteredMarkers(component, event, helper, 'state', null, null, stateName);
    }
});